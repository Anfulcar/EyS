import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { callResults, campaigns, companies, establishments, phones, users, type User } from "@/db/schema";
import { commitImport } from "@/lib/importer";
import { logCall, logVisit, relatedTasks, type CallInput } from "@/lib/workflow";

let agent: User;
let campaignId: number;

const rows = [
  { sigturId: "101", rut: "TA-0001", nombreComercial: "Buceo Uno", razonSocial: "Mar SRL", rnc: "130-111111", telefono: "(809) 555-0101", prioridad: "P1", estatusRnt: "Vencida" },
  { sigturId: "102", rut: "TA-0002", nombreComercial: "Buceo Dos", razonSocial: "Mar SRL", rnc: "130-111111", telefono: "(809) 555-0102", prioridad: "P2", estatusRnt: "Sin licencia" },
  { sigturId: "103", rut: "GS-0003", nombreComercial: "Tienda Tres", razonSocial: "Tienda SRL", rnc: "131-222222", telefono: "(829) 555-0103 / (849) 555-0113", prioridad: "P1", estatusRnt: "Vencida" },
];
const fields = new Set(["rut", "nombreComercial", "razonSocial", "rnc", "telefono", "prioridad", "estatusRnt"]);

async function taskOf(sigturId: string) {
  const e = await db.query.establishments.findFirst({ where: eq(establishments.sigturId, sigturId) });
  return (await db.query.companies.findFirst({ where: eq(companies.id, e!.companyId) }))!;
}

function call(companyId: number, over: Partial<CallInput>): CallInput {
  return {
    companyId, phoneId: null, calledAt: "2026-10-21T14:00:00.000Z", contacted: false, attended: null, noContactCode: "08",
    spokeWith: null, spokeRole: null, isResponsible: null, whatsappSent: false, updatedEmail: null, notes: null, results: [], ...over,
  };
}

beforeAll(async () => {
  [agent] = await db.insert(users).values({ username: "agente.test", name: "Agente Test", role: "agent", passwordHash: "x" }).returning();
  const [c] = await db.insert(campaigns).values({ name: "Test", startDate: "2026-10-19", endDate: "2026-12-31", status: "active" }).returning();
  campaignId = c.id;
  await commitImport(campaignId, rows, fields);
  await db.update(companies).set({ assignedUserId: agent.id }).where(eq(companies.campaignId, campaignId));
});

describe("upload grouping", () => {
  it("creates one task per RUT and links tasks with the same RNC", async () => {
    const all = await db.select().from(companies).where(eq(companies.campaignId, campaignId));
    expect(all).toHaveLength(3);
    const t1 = await taskOf("101");
    expect((await relatedTasks(t1)).map((r) => r.id)).toEqual([(await taskOf("102")).id]);
    expect(await relatedTasks(await taskOf("103"))).toEqual([]);
  });
  it("keeps every phone number of the establishment", async () => {
    const t3 = await taskOf("103");
    expect(await db.select().from(phones).where(eq(phones.companyId, t3.id))).toHaveLength(2);
  });
});

describe("call rules", () => {
  it("no answer → retry; after 3 failed attempts → visit", async () => {
    const t = await taskOf("103");
    await logCall(agent, call(t.id, {}));
    expect((await taskOf("103")).status).toBe("retry");
    await logCall(agent, call(t.id, {}));
    expect((await taskOf("103")).whatsappSuggested).toBe(true);
    await logCall(agent, call(t.id, {}));
    const after = await taskOf("103");
    expect(after.status).toBe("visit");
    const e = await db.query.establishments.findFirst({ where: eq(establishments.sigturId, "103") });
    expect(e?.requiereVisita).toBe("Sí");
    expect(e?.finalCode).toBe("08");
  });

  it("commitment → follow-up 5 business days after the commitment date", async () => {
    const t = await taskOf("101");
    const e = await db.query.establishments.findFirst({ where: eq(establishments.sigturId, "101") });
    await logCall(agent, call(t.id, {
      contacted: true, attended: true, noContactCode: null, spokeWith: "María", isResponsible: true,
      results: [{ establishmentId: e!.id, code: "01", commitmentDate: "2026-10-30" }],
    }));
    const after = await taskOf("101");
    expect(after.status).toBe("followup");
    expect(after.nextActionAt?.slice(0, 10)).toBe("2026-11-06");
  });

  it("commitment without a date is rejected", async () => {
    const t = await taskOf("102");
    const e = await db.query.establishments.findFirst({ where: eq(establishments.sigturId, "102") });
    await expect(logCall(agent, call(t.id, { contacted: true, attended: true, noContactCode: null, results: [{ establishmentId: e!.id, code: "01" }] }))).rejects.toThrow("commitmentRequired");
  });

  it("refusal → visit; the visit then schedules a follow-up call", async () => {
    const t = await taskOf("102");
    const e = await db.query.establishments.findFirst({ where: eq(establishments.sigturId, "102") });
    await logCall(agent, call(t.id, { contacted: true, attended: true, noContactCode: null, results: [{ establishmentId: e!.id, code: "04" }] }));
    expect((await taskOf("102")).status).toBe("visit");
    await logVisit(agent, { establishmentId: e!.id, visitDate: "2026-11-02", code: "V2", commitmentDate: "2026-11-10", notes: null });
    expect((await taskOf("102")).status).toBe("followup");
  });

  it("a call on a task the agent is not assigned to is refused", async () => {
    const [other] = await db.insert(users).values({ username: "otro", name: "Otro", role: "agent", passwordHash: "x" }).returning();
    await expect(logCall(other, call((await taskOf("101")).id, {}))).rejects.toThrow("Forbidden");
  });

  it("records one result per establishment", async () => {
    const e = await db.query.establishments.findFirst({ where: eq(establishments.sigturId, "103") });
    expect(await db.select().from(callResults).where(eq(callResults.establishmentId, e!.id))).toHaveLength(3);
  });
});
