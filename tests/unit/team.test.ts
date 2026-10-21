import { eq, inArray } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { absences, campaigns, companies, establishments, users, type Company } from "@/db/schema";
import { todayLocal } from "@/lib/dates";
import { coverTasks, distribute, moveTasks, syncCoverage, workload } from "@/lib/team";

const day = (n: number) => new Date(new Date(`${todayLocal()}T12:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
let ana: number, luis: number, sofia: number, campaignId: number;

async function task(key: string, owner: number | null, status = "pending", camp = campaignId, ests = 1) {
  const [c] = await db.insert(companies).values({ campaignId: camp, key, rnc: key, status, assignedUserId: owner }).returning();
  for (let i = 0; i < ests; i++) await db.insert(establishments).values({ campaignId: camp, companyId: c.id, sigturId: `${key}-${i}` });
  return c;
}
const ownerOf = async (ids: number[]) => (await db.select().from(companies).where(inArray(companies.id, ids))).map((c) => c.assignedUserId);

beforeAll(async () => {
  const mk = async (username: string, name: string) => (await db.insert(users).values({ username, name, role: "agent", passwordHash: "x" }).returning())[0].id;
  ana = await mk("eq.ana", "Ana");
  luis = await mk("eq.luis", "Luis");
  sofia = await mk("eq.sofia", "Sofía");
  campaignId = (await db.insert(campaigns).values({ name: "Equipo", startDate: "2026-01-01", endDate: "2030-12-31", status: "active" }).returning())[0].id;
});

describe("workload", () => {
  it("counts open establishments in campaigns that are not closed", async () => {
    await task("w-ana-1", ana, "pending", campaignId, 3);
    await task("w-ana-done", ana, "done", campaignId, 5);
    const closed = (await db.insert(campaigns).values({ name: "Cerrada", startDate: "2026-01-01", endDate: "2026-02-01", status: "closed" }).returning())[0].id;
    await task("w-ana-closed", ana, "pending", closed, 4);
    const load = await workload([ana, luis]);
    expect(load.get(ana)).toBe(3);
    expect(load.get(luis)).toBe(0);
  });

  it("gives more new tasks to whoever has less work", () => {
    const tasks = Array.from({ length: 6 }, (_, i) => ({ id: 1000 + i, rnc: `R${i}`, priority: "P1" }) as Company);
    const result = distribute(tasks, [ana, luis], new Map(), new Map([[ana, 4], [luis, 0]]));
    const count = (p: number) => [...result.values()].filter((x) => x === p).length;
    expect(count(luis)).toBe(5);
    expect(count(ana)).toBe(1);
    // Without the workload, an even split
    const even = distribute(tasks, [ana, luis], new Map());
    expect([...even.values()].filter((x) => x === ana).length).toBe(3);
  });
});

describe("moving tasks", () => {
  it("moves someone's open tasks permanently, finished ones stay", async () => {
    const open1 = await task("m-1", sofia);
    const open2 = await task("m-2", sofia);
    const done = await task("m-done", sofia, "done");
    expect(await moveTasks(campaignId, sofia, [luis])).toBe(2);
    expect(await ownerOf([open1.id, open2.id])).toEqual([luis, luis]);
    expect(await ownerOf([done.id])).toEqual([sofia]);
  });
});

describe("covering an absence", () => {
  it("moves the tasks on the first absent day and gives them back after the last one", async () => {
    const t1 = await task("c-1", ana);
    const t2 = await task("c-2", ana);
    const [abs] = await db.insert(absences).values({ userId: ana, fromDate: day(2), toDate: day(4), kind: "vacation" }).returning();
    await coverTasks(campaignId, abs.id, [luis]);
    // Not started yet: still Ana's
    expect(await ownerOf([t1.id, t2.id])).toEqual([ana, ana]);
    await syncCoverage(day(2), true);
    expect(await ownerOf([t1.id, t2.id])).toEqual([luis, luis]);
    await syncCoverage(day(4), true);
    expect(await ownerOf([t1.id])).toEqual([luis]);
    // The day after the absence: back to Ana, and the cover is over
    await syncCoverage(day(5), true);
    expect(await ownerOf([t1.id, t2.id])).toEqual([ana, ana]);
    const [c] = await db.select().from(companies).where(eq(companies.id, t1.id));
    expect(c.coverAbsenceId).toBeNull();
  });

  it("gives the tasks back at once when the absence is deleted", async () => {
    const t1 = await task("c-del", luis);
    const [abs] = await db.insert(absences).values({ userId: luis, fromDate: day(0), toDate: day(10), kind: "day_off" }).returning();
    await coverTasks(campaignId, abs.id, [sofia]);
    expect(await ownerOf([t1.id])).toEqual([sofia]);
    await db.delete(absences).where(eq(absences.id, abs.id));
    await syncCoverage(undefined, true);
    expect(await ownerOf([t1.id])).toEqual([luis]);
  });

  it("does not give tasks back in a closed campaign", async () => {
    const camp = (await db.insert(campaigns).values({ name: "Se cierra", startDate: "2026-01-01", endDate: "2030-12-31", status: "active" }).returning())[0].id;
    const t1 = await task("c-closed", sofia, "pending", camp);
    const [abs] = await db.insert(absences).values({ userId: sofia, fromDate: day(0), toDate: day(1), kind: "unavailable" }).returning();
    await coverTasks(camp, abs.id, [ana]);
    expect(await ownerOf([t1.id])).toEqual([ana]);
    await db.update(campaigns).set({ status: "closed" }).where(eq(campaigns.id, camp));
    await syncCoverage(day(2), true);
    expect(await ownerOf([t1.id])).toEqual([ana]);
  });
});
