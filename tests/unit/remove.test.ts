import { eq, inArray } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { callAttempts, callResults, campaigns, companies, establishments, historyArchive, phones, removedTasks, users, type User } from "@/db/schema";
import { commitImport } from "@/lib/importer";
import { idsByFilters, idsByKeys, previewRemoval, removedList, removeTasks } from "@/lib/remove";
import { logCall } from "@/lib/workflow";

let admin: User;
let campaignId: number;
const fields = new Set(["rut", "nombreComercial", "razonSocial", "rnc", "telefono", "estatusRnt", "subsector"]);
const taskOf = async (sigturId: string) => (await db.query.establishments.findFirst({ where: eq(establishments.sigturId, sigturId) }))!;

beforeAll(async () => {
  [admin] = await db.insert(users).values({ username: "rm.admin", name: "Admin Elimina", role: "admin", passwordHash: "x" }).returning();
  const [c] = await db.insert(campaigns).values({ name: "Para depurar", startDate: "2026-10-01", endDate: "2026-12-31", status: "active" }).returning();
  campaignId = c.id;
  await commitImport(campaignId, [
    { sigturId: "RM-1", rut: "RM-R1", nombreComercial: "Regalos Uno", razonSocial: "Uno SRL", rnc: "130-880001", telefono: "809-555-8001", estatusRnt: "Sin licencia", subsector: "Gift shops" },
    { sigturId: "RM-2", rut: "RM-R2", nombreComercial: "Regalos Dos", razonSocial: "Dos SRL", rnc: "130-880002", telefono: "809-555-8002", estatusRnt: "Sin licencia", subsector: "Gift shops" },
    { sigturId: "RM-3", rut: "RM-R3", nombreComercial: "Hotel Tres", razonSocial: "Tres SRL", rnc: "130-880003", telefono: "809-555-8003", estatusRnt: "Vencida", subsector: "Alojamiento" },
  ], fields);
  await db.update(companies).set({ assignedUserId: admin.id }).where(eq(companies.campaignId, campaignId));
});

describe("removing RUTs from a campaign", () => {
  it("picks tasks by filters or by a file of RUTs / ID SIGTUR", async () => {
    expect(await idsByFilters(campaignId, { rnt: "Sin licencia", sub: "Gift shops" })).toHaveLength(2);
    expect(await idsByFilters(campaignId, { rnt: "Vencida" })).toHaveLength(1);
    // Several choices in one filter: any of them; different filters: all of them.
    expect(await idsByFilters(campaignId, { rnt: "Vencida|Sin licencia" })).toHaveLength(3);
    expect(await idsByFilters(campaignId, { rnt: "Vencida|Sin licencia", sub: "Alojamiento" })).toHaveLength(1);
    expect(await idsByFilters(campaignId, { agent: `none|${admin.id}` })).toHaveLength(3);
    expect(await idsByFilters(campaignId, { status: "pending|done", f: "open|opNo" })).toHaveLength(3);
    const r = await idsByKeys(campaignId, ["rm-r1", "RM-2", "NO-EXISTE"]);
    expect(r.ids).toHaveLength(2);
    expect(r.notFound).toEqual(["NO-EXISTE"]);
  });

  it("shows the counts first, then deletes everything of those tasks and keeps the record and the history", async () => {
    const e1 = await taskOf("RM-1");
    await logCall(admin, {
      companyId: e1.companyId, phoneId: null, calledAt: "2026-10-20T14:00:00.000Z", contacted: true, attended: true, noContactCode: null,
      spokeWith: "Dueña", spokeRole: null, isResponsible: true, whatsappSent: false, updatedEmail: null, notes: null,
      results: [{ establishmentId: e1.id, code: "01", enOperacion: "Sí", commitmentDate: "2026-11-15" }],
    });
    const ids = await idsByFilters(campaignId, { sub: "Gift shops" });
    const p = await previewRemoval(campaignId, [...ids, 999999]);
    expect(p).toMatchObject({ tasks: 2, establishments: 2, calls: 1, visits: 0, tooMany: false });

    const r = await removeTasks(admin, campaignId, ids, "Fuera de alcance");
    expect(r.removed).toBe(2);
    expect(await db.select().from(companies).where(inArray(companies.id, ids))).toHaveLength(0);
    expect(await db.select().from(establishments).where(inArray(establishments.companyId, ids))).toHaveLength(0);
    expect(await db.select().from(phones).where(inArray(phones.companyId, ids))).toHaveLength(0);
    expect(await db.select().from(callAttempts).where(inArray(callAttempts.companyId, ids))).toHaveLength(0);
    expect(await db.select().from(callResults).where(eq(callResults.establishmentId, e1.id))).toHaveLength(0);
    // The other task stays.
    expect(await db.select().from(companies).where(eq(companies.campaignId, campaignId))).toHaveLength(1);

    const list = await removedList(campaignId);
    expect(list.map((x) => x.rut).sort()).toEqual(["RM-R1", "RM-R2"]);
    expect(list.find((x) => x.rut === "RM-R1")).toMatchObject({ reason: "Fuera de alcance", calls: 1, removedByName: "Admin Elimina" });
    // The commitment is kept for warnings in later campaigns.
    expect(await db.select().from(historyArchive).where(eq(historyArchive.rut, "RM-R1"))).toEqual([expect.objectContaining({ kind: "commitment", date: "2026-11-15" })]);
  });

  it("refuses closed campaigns and tasks of other campaigns", async () => {
    const [other] = await db.insert(campaigns).values({ name: "Otra", startDate: "2026-10-01", endDate: "2026-12-31", status: "active" }).returning();
    const e3 = await taskOf("RM-3");
    expect((await removeTasks(admin, other.id, [e3.companyId], "x")).removed).toBe(0);
    await db.update(campaigns).set({ status: "closed" }).where(eq(campaigns.id, campaignId));
    expect(await removeTasks(admin, campaignId, [e3.companyId], "x")).toMatchObject({ removed: 0, closed: true });
    expect(await db.select().from(removedTasks).where(eq(removedTasks.rut, "RM-R3"))).toHaveLength(0);
  });
});
