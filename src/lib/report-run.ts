import "server-only";
import { and, eq, gt, isNotNull, lt, lte, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { generatedReports, reportTemplates, users } from "@/db/schema";
import { logActivity, logError } from "./audit";
import type { Lang } from "./catalog";
import { todayLocal } from "./dates";
import { buildReport } from "./report-data";
import { cleanOptions, nextRun, type Frequency, type ReportOptions } from "./report-options";
import { renderPdf } from "./report-pdf";
import { renderPptx } from "./report-pptx";

export const MIME = { pdf: "application/pdf", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation" } as const;

export async function generateReport(o: ReportOptions, who: { name: string; scheduled?: boolean }, lang: Lang = "es") {
  const data = await buildReport(o, who, lang);
  const content = o.format === "pptx" ? await renderPptx(data, o.sections) : await renderPdf(data, o.sections);
  const slug = o.title.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 60) || "Informe";
  return { content, fileName: `${slug}_${todayLocal()}.${o.format}`, mime: MIME[o.format], periodLabel: data.periodShort };
}

// Generates a template's report and keeps it in "Informes generados".
export async function generateAndStore(templateId: number, source: "scheduled" | "manual", byUserId: number | null) {
  const tpl = await db.query.reportTemplates.findFirst({ where: eq(reportTemplates.id, templateId) });
  if (!tpl) throw new Error("Not found");
  const owner = byUserId ?? tpl.createdBy;
  const person = owner ? await db.query.users.findFirst({ where: eq(users.id, owner) }) : null;
  const o = cleanOptions(JSON.parse(tpl.options));
  const r = await generateReport(o, { name: person?.name ?? "—", scheduled: source === "scheduled" });
  const [row] = await db
    .insert(generatedReports)
    .values({ templateId: tpl.id, name: tpl.name, periodLabel: r.periodLabel, format: o.format, fileName: r.fileName, content: r.content, source, createdBy: byUserId })
    .returning({ id: generatedReports.id });
  return row.id;
}

let lastCheck = 0;

// Runs every scheduled report that is due today or earlier. Called by the daily schedule (Vercel Cron)
// and, as a fallback, when managers open the reports screens (at most every 10 minutes).
export async function runDueReports(today = todayLocal(), force = false) {
  if (!force && Date.now() - lastCheck < 10 * 60_000) return 0;
  lastCheck = Date.now();
  const due = await db
    .select()
    .from(reportTemplates)
    .where(and(ne(reportTemplates.frequency, "none"), eq(reportTemplates.paused, false), isNotNull(reportTemplates.nextRunOn), lte(reportTemplates.nextRunOn, today)));
  let n = 0;
  for (const tpl of due) {
    const next = nextRun(tpl.frequency as Frequency, tpl.runDay ?? 1, tpl.nextRunOn!, today);
    // Claim the run first, so two servers never generate the same report twice.
    const claimed = await db
      .update(reportTemplates)
      .set({ nextRunOn: next })
      .where(and(eq(reportTemplates.id, tpl.id), eq(reportTemplates.nextRunOn, tpl.nextRunOn!)))
      .returning({ id: reportTemplates.id });
    if (!claimed.length) continue;
    try {
      await generateAndStore(tpl.id, "scheduled", null);
      await logActivity(null, "report.generated", { entity: "report", entityId: tpl.id, summary: `Informe programado: ${tpl.name}` });
      n++;
    } catch (e) {
      await logError("server", `Informe programado «${tpl.name}»: ${(e as Error).message}`, { detail: (e as Error).stack ?? null });
    }
  }
  // Reports are kept for 12 months.
  const cutoff = new Date(Date.now() - 365 * 86400000).toISOString();
  await db.delete(generatedReports).where(lt(generatedReports.createdAt, cutoff));
  return n;
}

export async function newReportsCount(user: { createdAt: string; reportsSeenAt: string | null }) {
  const since = user.reportsSeenAt ?? user.createdAt;
  const [r] = await db.select({ n: sql<number>`count(*)` }).from(generatedReports).where(gt(generatedReports.createdAt, since));
  return Number(r?.n ?? 0);
}
