import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { campaigns, companies, establishments, phones, users } from "@/db/schema";
import { countTransfer, transferToNewCampaign } from "@/lib/transfer";

describe("new campaign from another campaign's results", () => {
  it("copies the chosen tasks and closes them in the original as transferred", async () => {
    const [admin] = await db.insert(users).values({ username: "tr.admin", name: "Admin", role: "admin", passwordHash: "x" }).returning();
    const [from] = await db.insert(campaigns).values({ name: "Origen", startDate: "2026-01-01", endDate: "2030-12-31", status: "active", scriptEs: "Guion origen" }).returning();
    const mk = async (key: string, status: string, lastCode: string | null) => {
      const [c] = await db.insert(companies).values({ campaignId: from.id, key, status, lastCode, attempts: lastCode ? 2 : 0 }).returning();
      await db.insert(establishments).values({ campaignId: from.id, companyId: c.id, sigturId: key, nombreComercial: key, finalCode: lastCode, fechaCompromiso: "2026-10-01" });
      await db.insert(phones).values({ campaignId: from.id, companyId: c.id, number: "809-555-0000", normalized: "8095550000", source: "file", kind: "original" });
      return c;
    };
    const fu = await mk("t-followup", "followup", "01");
    const re = await mk("t-retry", "retry", "08");
    const done = await mk("t-done", "done", "02");

    expect(await countTransfer(from.id, { statuses: ["followup", "retry"] })).toBe(2);
    expect(await countTransfer(from.id, { statuses: ["followup", "retry"], code: "08" })).toBe(1);

    const r = await transferToNewCampaign(from, { statuses: ["followup", "retry"] }, { name: "Seguimiento", description: "", startDate: "2026-11-01", endDate: "2026-12-31", maxAttempts: 3, followupDays: 5 }, admin.id);
    expect(r?.count).toBe(2);
    expect(r?.campaign).toMatchObject({ status: "draft", source: "transfer", scriptEs: "Guion origen" });

    const copied = await db.select().from(companies).where(eq(companies.campaignId, r!.campaign.id));
    expect(copied.map((c) => c.key).sort()).toEqual(["t-followup", "t-retry"]);
    expect(copied.every((c) => c.status === "pending" && c.originNote?.startsWith("Viene de «Origen»"))).toBe(true);
    const ests = await db.select().from(establishments).where(eq(establishments.campaignId, r!.campaign.id));
    expect(ests.every((e) => e.finalCode === null && e.fechaCompromiso === null)).toBe(true);
    expect(await db.select().from(phones).where(eq(phones.campaignId, r!.campaign.id))).toHaveLength(2);

    const after = async (id: number) => (await db.select().from(companies).where(eq(companies.id, id)))[0];
    expect(await after(fu.id)).toMatchObject({ status: "transferred", transferredToCampaignId: r!.campaign.id });
    expect(await after(re.id)).toMatchObject({ status: "transferred" });
    expect(await after(done.id)).toMatchObject({ status: "done" });
  });
});
