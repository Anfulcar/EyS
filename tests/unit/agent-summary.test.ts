import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { callAttempts, callResults, campaigns, companies, establishments, users } from "@/db/schema";
import { agentSummary } from "@/lib/agent-summary";

describe("agent summary", () => {
  it("counts tasks now, and calls / contacts / commitments / results in the chosen period and campaign", async () => {
    const [ag] = await db.insert(users).values({ username: "as.agent", name: "Ana Resumen", role: "agent", passwordHash: "x" }).returning();
    const [c1] = await db.insert(campaigns).values({ name: "AS uno", startDate: "2026-01-01", endDate: "2030-12-31", status: "active" }).returning();
    const [c2] = await db.insert(campaigns).values({ name: "AS dos", startDate: "2026-01-01", endDate: "2030-12-31", status: "active" }).returning();
    const task = async (campaignId: number, key: string, status: string) => {
      const [t] = await db.insert(companies).values({ campaignId, key, status, assignedUserId: ag.id }).returning();
      const [e] = await db.insert(establishments).values({ campaignId, companyId: t.id, sigturId: key, nombreComercial: key }).returning();
      return { t, e };
    };
    const a = await task(c1.id, "AS-1", "followup");
    const b = await task(c1.id, "AS-2", "done");
    await task(c2.id, "AS-3", "pending");
    const call = async (x: { t: { id: number; campaignId: number }; e: { id: number } }, at: string, code: string, contacted: boolean) => {
      const [att] = await db.insert(callAttempts).values({ campaignId: x.t.campaignId, companyId: x.t.id, userId: ag.id, calledAt: at, attemptNo: 1, contacted, attended: contacted ? true : null, noContactCode: contacted ? null : code }).returning();
      await db.insert(callResults).values({ attemptId: att.id, campaignId: x.t.campaignId, establishmentId: x.e.id, code });
    };
    await call(a, "2026-10-20T14:00:00.000Z", "01", true);
    await call(b, "2026-10-21T14:00:00.000Z", "08", false);
    await call(b, "2026-10-27T14:00:00.000Z", "02", true);

    const all = await agentSummary(ag.id, {});
    expect(all).toMatchObject({ tasks: 3, open: 2, calls: 3, contacts: 2, commitments: 1, notReviewed: 3 });
    const one = await agentSummary(ag.id, { campaignId: c1.id, from: "2026-10-20", to: "2026-10-21" });
    expect(one).toMatchObject({ tasks: 2, calls: 2, contacts: 1, commitments: 1 });
    expect(one.byCode.map((x) => x.code).sort()).toEqual(["01", "08"]);
    expect(one.byDay.map((d) => d.day)).toEqual(["2026-10-20", "2026-10-21"]);
    // Nothing of other people.
    const [other] = await db.insert(users).values({ username: "as.other", name: "Otro", role: "agent", passwordHash: "x" }).returning();
    expect((await agentSummary(other.id, {})).calls).toBe(0);
    await db.update(companies).set({ assignedUserId: null }).where(eq(companies.campaignId, c2.id));
  });
});
