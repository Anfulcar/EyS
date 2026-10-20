import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { campaigns, companies, establishments, users } from "@/db/schema";
import { attentionSummary, daysSince } from "@/lib/queue";

const hours = (h: number) => new Date(Date.now() + h * 3600000).toISOString();
let agentId: number;

beforeAll(async () => {
  const [a] = await db.insert(users).values({ username: "cola.agente", name: "Cola", role: "agent", passwordHash: "x" }).returning();
  agentId = a.id;
  const [c] = await db.insert(campaigns).values({ name: "Cola", startDate: "2026-01-01", endDate: "2030-12-31", status: "active" }).returning();
  const tasks = [
    { key: "new", status: "pending", nextActionAt: null },
    { key: "retry-due", status: "retry", nextActionAt: hours(-2) },
    { key: "followup-overdue", status: "followup", nextActionAt: hours(-48) },
    { key: "followup-later", status: "followup", nextActionAt: hours(72) },
    { key: "visit", status: "visit", nextActionAt: null },
  ];
  for (const t of tasks) {
    const [co] = await db.insert(companies).values({ campaignId: c.id, key: t.key, status: t.status, nextActionAt: t.nextActionAt, assignedUserId: agentId }).returning();
    await db.insert(establishments).values({ campaignId: c.id, companyId: co.id, sigturId: t.key });
  }
});

describe("calls that need attention", () => {
  it("counts new, due retries and overdue follow-ups, not future ones or visits", async () => {
    expect(await attentionSummary(agentId)).toEqual({ total: 3, overdueFollowups: 1, dueToday: 2 });
  });
  it("only counts the person's own calls", async () => {
    const [other] = await db.insert(users).values({ username: "otra.agente", name: "Otra", role: "agent", passwordHash: "x" }).returning();
    expect((await attentionSummary(other.id)).total).toBe(0);
  });
  it("ignores closed campaigns", async () => {
    const [c] = await db.select().from(campaigns).where(eq(campaigns.name, "Cola"));
    await db.update(campaigns).set({ status: "closed" }).where(eq(campaigns.id, c.id));
    expect((await attentionSummary(agentId)).total).toBe(0);
    await db.update(campaigns).set({ status: "active" }).where(eq(campaigns.id, c.id));
  });
});

describe("days waiting", () => {
  const now = Date.parse("2026-10-21T15:00:00Z"); // 11:00 in Santo Domingo
  it("counts calendar days in Dominican Republic time", () => {
    expect(daysSince("2026-10-21T13:00:00Z", now)).toBe(0);
    expect(daysSince("2026-10-20T20:00:00Z", now)).toBe(1);
    expect(daysSince("2026-10-18T15:00:00Z", now)).toBe(3);
    expect(daysSince(null, now)).toBeNull();
  });
});
