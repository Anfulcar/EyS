import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { callAttempts, callResults, campaigns, companies, establishments, generatedReports, reportTemplates, users } from "@/db/schema";
import { buildReport } from "@/lib/report-data";
import { cleanOptions, DEFAULT_OPTIONS, firstRun, nextRun, REPORT_SECTIONS, resolvePeriod } from "@/lib/report-options";
import { renderPdf } from "@/lib/report-pdf";
import { renderPptx } from "@/lib/report-pptx";
import { runDueReports } from "@/lib/report-run";
import { computeStats } from "@/lib/stats";

let campaignId: number, adminId: number;

beforeAll(async () => {
  [{ id: adminId }] = await db.insert(users).values({ username: "inf.admin", name: "Adriana", role: "admin", passwordHash: "x" }).returning();
  [{ id: campaignId }] = await db.insert(campaigns).values({ name: "Informe prueba", startDate: "2026-01-01", endDate: "2030-12-31", status: "active" }).returning();
  for (const [i, code] of ["01", "08", "05"].entries()) {
    const [co] = await db.insert(companies).values({ campaignId, key: `inf-${i}`, status: code === "01" ? "followup" : "retry", assignedUserId: adminId }).returning();
    const [e] = await db.insert(establishments).values({ campaignId, companyId: co.id, sigturId: `inf-${i}`, nombreComercial: `Hotel ${i}`, estatusRnt: "Vencida", prioridad: "P1", zonaOperativa: "A1. Bávaro", finalCode: code, requiereVisita: code === "05" ? "Sí" : "No" }).returning();
    const [a] = await db.insert(callAttempts).values({ campaignId, companyId: co.id, userId: adminId, calledAt: "2026-10-14T15:00:00.000Z", attemptNo: 1, contacted: code !== "08", attended: code !== "08" ? true : null, isResponsible: code !== "08" }).returning();
    await db.insert(callResults).values({ attemptId: a.id, campaignId, establishmentId: e.id, code });
  }
});

describe("report periods and schedules", () => {
  it("works out relative periods from the day the report is made", () => {
    expect(resolvePeriod({ period: "lastWeek" }, "2026-10-21")).toEqual({ from: "2026-10-12", to: "2026-10-18" }); // Wednesday → Mon–Sun before
    expect(resolvePeriod({ period: "lastWeek" }, "2026-10-19")).toEqual({ from: "2026-10-12", to: "2026-10-18" }); // Monday
    expect(resolvePeriod({ period: "last7" }, "2026-10-21")).toEqual({ from: "2026-10-15", to: "2026-10-21" });
    expect(resolvePeriod({ period: "lastMonth" }, "2026-03-05")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(resolvePeriod({ period: "thisMonth" }, "2026-10-21")).toEqual({ from: "2026-10-01", to: "2026-10-21" });
    expect(resolvePeriod({ period: "all" }, "2026-10-21")).toEqual({ from: null, to: null });
  });
  it("schedules weekly, every 2 weeks and monthly runs", () => {
    expect(firstRun("weekly", 1, "2026-10-21")).toBe("2026-10-26"); // next Monday
    expect(firstRun("weekly", 3, "2026-10-21")).toBe("2026-10-21"); // today is Wednesday
    expect(nextRun("weekly", 1, "2026-10-26", "2026-10-26")).toBe("2026-11-02");
    expect(nextRun("biweekly", 1, "2026-10-26", "2026-10-26")).toBe("2026-11-09");
    expect(firstRun("monthly", 1, "2026-10-21")).toBe("2026-11-01");
    expect(nextRun("monthly", 1, "2026-12-01", "2026-12-01")).toBe("2027-01-01");
  });
  it("cleans anything that comes from a link", () => {
    const o = cleanOptions({ sections: ["goals", "bogus"] as never, format: "exe" as never, period: "x" as never, campaignIds: ["3", "-1", "a"] as never });
    expect(o.sections).toEqual(["goals"]);
    expect(o.format).toBe("pdf");
    expect(o.period).toBe("all");
    expect(o.campaignIds).toEqual([3]);
  });
});

describe("report content and files", () => {
  const options = cleanOptions({ ...DEFAULT_OPTIONS, campaigns: "pick", campaignIds: [0], sections: [...REPORT_SECTIONS], period: "custom", from: "2026-10-12", to: "2026-10-18" });

  it("uses the same numbers as the dashboard", async () => {
    const d = await buildReport({ ...options, campaignIds: [campaignId] }, { name: "Adriana" }, "es", "2026-10-21");
    const s = await computeStats([campaignId]);
    expect(d.goals[0]).toMatchObject({ n: s.called, d: s.universe, delta: 3 });
    expect(d.counts.find(([k]) => k === "Llamadas en el período")?.[1]).toBe(3);
    // Results are shown as text, never as codes
    expect(d.codes.map((c) => c.label)).toContain("No contesta");
    expect(d.detail.rows.map((r) => r[0])).toEqual(["Hotel 2"]);
    // No phone numbers or contact people in the detail
    expect(d.detail.head).not.toContain("Teléfono");
  });

  it("produces a PDF and a PowerPoint", async () => {
    const d = await buildReport({ ...options, campaignIds: [campaignId] }, { name: "Adriana" }, "es", "2026-10-21");
    const pdf = await renderPdf(d, options.sections);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    const pptx = await renderPptx(d, options.sections);
    expect(pptx.subarray(0, 2).toString()).toBe("PK"); // a .pptx is a zip file
  });

  it("generates scheduled reports once when due and moves to the next date", async () => {
    const [tpl] = await db
      .insert(reportTemplates)
      .values({ name: "Semanal Dirección", options: JSON.stringify({ ...options, campaignIds: [campaignId], period: "lastWeek", format: "pptx" }), frequency: "weekly", runDay: 1, nextRunOn: "2026-10-19", createdBy: adminId })
      .returning();
    expect(await runDueReports("2026-10-21", true)).toBe(1);
    expect(await runDueReports("2026-10-21", true)).toBe(0); // not twice
    const [after] = await db.select().from(reportTemplates).where(eq(reportTemplates.id, tpl.id));
    expect(after.nextRunOn).toBe("2026-10-26");
    const files = await db.select().from(generatedReports).where(eq(generatedReports.templateId, tpl.id));
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({ format: "pptx", source: "scheduled" });
  });
});
