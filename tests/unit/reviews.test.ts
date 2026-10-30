import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { callAttempts, callResults, campaigns, companies, establishments, users, type User } from "@/db/schema";
import { callDetail, callRows, reviewCall } from "@/lib/reviews";
import { computeStats, computeStatsByCampaign, drillDown, METRICS } from "@/lib/stats";

let ana: User, beto: User, sup: User, campaignId: number;
const callIds: Record<string, number> = {};

beforeAll(async () => {
  [ana] = await db.insert(users).values({ username: "rev.ana", name: "Ana", role: "agent", passwordHash: "x" }).returning();
  [beto] = await db.insert(users).values({ username: "rev.beto", name: "Beto", role: "agent", passwordHash: "x" }).returning();
  [sup] = await db.insert(users).values({ username: "rev.sup", name: "Sup", role: "supervisor", passwordHash: "x" }).returning();
  const [c] = await db.insert(campaigns).values({ name: "Revisión", startDate: "2026-01-01", endDate: "2030-12-31", status: "active" }).returning();
  campaignId = c.id;
  const rows = [
    { key: "rev-a", agent: ana, est: { finalCode: "01", fechaCompromiso: "2026-11-05", enOperacion: "Sí" }, code: "01" },
    { key: "rev-b", agent: beto, est: { finalCode: "04", requiereVisita: "Sí", enOperacion: "Sí" }, code: "04" },
    { key: "rev-c", agent: beto, est: { finalCode: "05", enOperacion: "No" }, code: "05" },
    { key: "rev-d", agent: ana, est: {}, code: null },
  ];
  for (const r of rows) {
    const [co] = await db.insert(companies).values({ campaignId, key: r.key, status: "pending", assignedUserId: r.agent.id }).returning();
    const [e] = await db.insert(establishments).values({ campaignId, companyId: co.id, sigturId: r.key, nombreComercial: r.key, ...r.est }).returning();
    if (!r.code) continue;
    const [a] = await db
      .insert(callAttempts)
      .values({ campaignId, companyId: co.id, userId: r.agent.id, calledAt: new Date().toISOString(), attemptNo: 1, contacted: true, attended: true })
      .returning();
    await db.insert(callResults).values({ attemptId: a.id, campaignId, establishmentId: e.id, code: r.code });
    callIds[r.key] = a.id;
  }
});

describe("calls made and their review", () => {
  it("agents only see their own calls", async () => {
    const mine = await callRows(ana, { campaign: String(campaignId) }, 50);
    expect(mine.map((r) => r.name)).toEqual(["rev-a"]);
    expect(await callDetail(ana, callIds["rev-b"])).toBeNull();
    expect((await callDetail(ana, callIds["rev-a"]))?.results[0].r.code).toBe("01");
  });
  it("supervisors see everyone's calls and can filter them", async () => {
    expect(await callRows(sup, { campaign: String(campaignId) }, 50)).toHaveLength(3);
    expect((await callRows(sup, { campaign: String(campaignId), agent: String(beto.id) }, 50)).map((r) => r.name).sort()).toEqual(["rev-b", "rev-c"]);
    expect((await callRows(sup, { campaign: String(campaignId), code: "05" }, 50)).map((r) => r.name)).toEqual(["rev-c"]);
  });
  it("filters accept several choices: any of them within a filter, all filters together", async () => {
    const names = async (f: Record<string, string>) => (await callRows(sup, { campaign: String(campaignId), ...f }, 50)).map((r) => r.name).sort();
    expect(await names({ code: "01|05" })).toEqual(["rev-a", "rev-c"]);
    expect(await names({ agent: `${ana.id}|${beto.id}` })).toEqual(["rev-a", "rev-b", "rev-c"]);
    expect(await names({ agent: String(beto.id), code: "01|05" })).toEqual(["rev-c"]);
    // Both review states ticked = no filter.
    expect(await names({ review: "yes|no" })).toHaveLength(3);
  });
  it("only supervisors and administrators can mark a call as reviewed", async () => {
    await expect(reviewCall(ana, callIds["rev-a"], "hola")).rejects.toThrow("Not found");
    await reviewCall(sup, callIds["rev-a"], "  Buen trabajo  ");
    const d = await callDetail(ana, callIds["rev-a"]);
    expect(d?.a.reviewComment).toBe("Buen trabajo");
    expect(d?.reviewerName).toBe("Sup");
    expect(await callRows(sup, { campaign: String(campaignId), review: "no" }, 50)).toHaveLength(2);
    expect(await callRows(sup, { campaign: String(campaignId), review: "yes" }, 50)).toHaveLength(1);
  });
});

describe("dashboard lists", () => {
  it("global statistics read once give the same numbers as each campaign's dashboard", async () => {
    const [other] = await db.insert(campaigns).values({ name: "Otra", startDate: "2026-01-01", endDate: "2030-12-31", status: "active" }).returning();
    const both = await computeStatsByCampaign([campaignId, other.id], [campaignId, other.id]);
    expect(both.per.get(campaignId)).toEqual(await computeStats([campaignId]));
    expect(both.all).toEqual(await computeStats([campaignId, other.id]));
  });
  it("each list has exactly as many establishments as the number it opens from", async () => {
    const s = await computeStats([campaignId]);
    const expected: Partial<Record<(typeof METRICS)[number], number>> = {
      all: s.universe, called: s.called, typified: s.typified, commitments: s.commitments, closed: s.closed,
      needVisit: s.needVisit, operatingContacted: s.operatingContacted,
    };
    for (const [metric, n] of Object.entries(expected)) {
      expect((await drillDown([campaignId], { metric: metric as (typeof METRICS)[number] })).length, metric).toBe(n);
    }
    expect((await drillDown([campaignId], { metric: "needVisit" })).map((r) => r.e.sigturId)).toEqual(["rev-b"]);
    expect((await drillDown([campaignId], { dim: "code", value: "05" })).map((r) => r.e.sigturId)).toEqual(["rev-c"]);
    expect((await drillDown([campaignId], { dim: "agent", value: String(beto.id) })).length).toBe(2);
  });
});
