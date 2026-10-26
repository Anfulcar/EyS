import { eq } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { campaigns, companies, establishments, historyArchive, sigturOutbox, users, type User } from "@/db/schema";
import { operationOf } from "@/lib/catalog";
import { archiveCampaignHistory, historyFor } from "@/lib/history";
import { commitImport } from "@/lib/importer";
import { requestDeadline } from "@/lib/sigtur";
import { flushOutbox, queueCallInteractions, queueChanges, resolveRequest, setPushEnabled, setPushUrl } from "@/lib/sigtur-push";
import { logCall, type CallInput } from "@/lib/workflow";

let agent: User;
let oldId: number;
let newId: number;
const fields = new Set(["rut", "nombreComercial", "razonSocial", "rnc", "telefono", "direccion"]);

const est = (sigturId: string) => db.query.establishments.findFirst({ where: eq(establishments.sigturId, sigturId) });
async function taskOf(sigturId: string) {
  const e = await est(sigturId);
  return (await db.query.companies.findFirst({ where: eq(companies.id, e!.companyId) }))!;
}
function call(companyId: number, over: Partial<CallInput>): CallInput {
  return {
    companyId, phoneId: null, calledAt: "2026-09-01T14:00:00.000Z", contacted: true, attended: true, noContactCode: null,
    spokeWith: "Encargado", spokeRole: "Gerente", isResponsible: true, whatsappSent: false, updatedEmail: null, notes: null, results: [], ...over,
  };
}

beforeAll(async () => {
  [agent] = await db.insert(users).values({ username: "hx.agent", name: "Ana Historia", role: "agent", passwordHash: "x" }).returning();
  const [o] = await db.insert(campaigns).values({ name: "Q3 anterior", startDate: "2026-07-01", endDate: "2026-09-30", status: "active" }).returning();
  const [n] = await db.insert(campaigns).values({ name: "Q4 actual", startDate: "2026-10-01", endDate: "2026-12-31", status: "active" }).returning();
  oldId = o.id;
  newId = n.id;
  // Same RUTs in both campaigns; HX-3 is another RUT of HX-2's company (same RNC).
  await commitImport(oldId, [
    { sigturId: "HX-1o", rut: "HX-R1", nombreComercial: "Hotel Uno", razonSocial: "Uno SRL", rnc: "130-777001", telefono: "809-555-7001", direccion: "Calle 1" },
    { sigturId: "HX-3o", rut: "HX-R3", nombreComercial: "Sucursal Tres", razonSocial: "Dos SRL", rnc: "130-777002", telefono: "809-555-7003" },
  ], fields);
  await commitImport(newId, [
    { sigturId: "HX-1n", rut: "HX-R1", nombreComercial: "Hotel Uno", razonSocial: "Uno SRL", rnc: "130-777001", telefono: "809-555-7001", direccion: "Calle 1" },
    { sigturId: "HX-2n", rut: "HX-R2", nombreComercial: "Tienda Dos", razonSocial: "Dos SRL", rnc: "130-777002", telefono: "809-555-7002" },
  ], fields);
  await db.update(companies).set({ assignedUserId: agent.id });
});

afterEach(() => vi.unstubAllGlobals());

describe("history across campaigns", () => {
  it("warns about a commitment of the same RUT and a closure of the same company", async () => {
    const t1 = await taskOf("HX-1o");
    const e1 = (await est("HX-1o"))!;
    await logCall(agent, call(t1.id, { results: [{ establishmentId: e1.id, code: "01", enOperacion: "Sí", commitmentDate: "2026-09-15" }] }));
    const t3 = await taskOf("HX-3o");
    const e3 = (await est("HX-3o"))!;
    await logCall(agent, call(t3.id, { results: [{ establishmentId: e3.id, code: "05", closedSince: "03/2026" }] }));

    const forOne = await historyFor(newId, [{ rut: "HX-R1", rnc: "130-777001" }]);
    expect(forOne).toEqual([expect.objectContaining({ kind: "commitment", rut: "HX-R1", campaignName: "Q3 anterior", date: "2026-09-15", byName: "Ana Historia", sameCompany: false })]);
    const forTwo = await historyFor(newId, [{ rut: "HX-R2", rnc: "130-777002" }]);
    expect(forTwo).toEqual([expect.objectContaining({ kind: "closed", rut: "HX-R3", date: "03/2026", sameCompany: true })]);
    // Nothing from the campaign being worked.
    expect(await historyFor(oldId, [{ rut: "HX-R1", rnc: "130-777001" }])).toEqual([]);
  });

  it("keeps the warnings when the old campaign is deleted", async () => {
    expect(await archiveCampaignHistory(oldId)).toBe(2);
    await db.delete(campaigns).where(eq(campaigns.id, oldId));
    const notes = await historyFor(newId, [{ rut: "HX-R1", rnc: "130-777001" }, { rut: "HX-R2", rnc: "130-777002" }]);
    expect(notes.map((n) => n.kind).sort()).toEqual(["closed", "commitment"]);
    expect(await db.select().from(historyArchive)).toHaveLength(2);
  });
});

describe("operating status", () => {
  it("closed wins, then the last answer", () => {
    expect(operationOf({ enOperacion: "Sí", finalCode: "05" })).toBe("no");
    expect(operationOf({ enOperacion: "Sí", finalCode: "01", estatusSigturActualizado: "Inactivo (depurado)" })).toBe("no");
    expect(operationOf({ enOperacion: "Sí", finalCode: "01" })).toBe("yes");
    expect(operationOf({ enOperacion: "No sabe", finalCode: "03" })).toBe("unknown");
    expect(operationOf({ enOperacion: null, finalCode: "08" })).toBe("none");
  });
});

describe("SIGTUR request deadlines", () => {
  const base = { sigturRequest: true, requestDueDate: null, requestResolvedAt: null };
  it("2 working days, tomorrow, overdue; solved requests have none", () => {
    // Friday 23 Oct → due Tuesday 27 Oct
    expect(requestDeadline({ ...base, requestedAt: "2026-10-23T14:00:00.000Z" }, "2026-10-23")).toMatchObject({ due: "2026-10-27", state: "ok" });
    expect(requestDeadline({ ...base, requestedAt: "2026-10-23T14:00:00.000Z" }, "2026-10-26")).toMatchObject({ state: "tomorrow" });
    expect(requestDeadline({ ...base, requestedAt: "2026-10-23T14:00:00.000Z" }, "2026-10-29")).toMatchObject({ state: "overdue", days: 2 });
    expect(requestDeadline({ ...base, requestDueDate: "2026-11-30", requestedAt: "2026-10-23T14:00:00.000Z" }, "2026-10-29")).toMatchObject({ due: "2026-11-30", state: "ok" });
    expect(requestDeadline({ ...base, requestResolvedAt: "2026-10-24T10:00:00.000Z", requestedAt: "2026-10-23T14:00:00.000Z" }, "2026-10-29")).toBeNull();
  });
});

describe("sending to SIGTUR", () => {
  it("queues the agent's changes, the interaction and a solved request; sends only when switched on", async () => {
    const t = await taskOf("HX-1n");
    const e = (await est("HX-1n"))!;
    await db.update(companies).set({ sigturRequest: true, requestedBy: "María (Licencias)", requestedAt: "2026-10-26T12:00:00.000Z", requestRef: "SOL-9" }).where(eq(companies.id, t.id));
    const out = await logCall(agent, call(t.id, {
      updatedEmail: "nuevo@example.com",
      results: [{ establishmentId: e.id, code: "06", enOperacion: "Sí", newAddress: "Av. Nueva 14", newName: "Hotel Uno Bávaro" }],
    }));
    expect(out.answered).toBe(true);
    expect(out.changes.map((c) => c.field).sort()).toEqual(["correo", "direccion", "enOperacion", "nombreComercial"]);
    expect((await est("HX-1n"))!.direccion).toBe("Av. Nueva 14");

    await queueCallInteractions(out.attemptId);
    await queueChanges(out.changes, agent, "Llamada");
    await resolveRequest(t.id, { result: out.result, attemptId: out.attemptId });
    await resolveRequest(t.id, { result: out.result, attemptId: out.attemptId }); // only once
    const queued = await db.select().from(sigturOutbox).where(eq(sigturOutbox.sigturId, "HX-1n"));
    expect(queued.map((q) => q.kind).sort()).toEqual(["change", "change", "change", "change", "interaction", "resolved"]);
    const resolved = JSON.parse(queued.find((q) => q.kind === "resolved")!.payload);
    expect(resolved).toMatchObject({ tipo: "solicitudResuelta", datos: { idSolicitud: "SOL-9", solicitadoPor: "María (Licencias)", resultado: "Cambió dueño / nombre / dirección" } });
    expect((await taskOf("HX-1n")).requestResolvedAt).not.toBeNull();

    // Off (or not ready): nothing leaves.
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await flushOutbox(true)).toEqual({ sent: 0, failed: 0 });
    expect(fetchMock).not.toHaveBeenCalled();

    // On, with address and key: everything goes, oldest first, with SIGTUR's key.
    vi.stubEnv("SIGTUR_PUSH_KEY", "test-only-key");
    await setPushUrl("https://sigtur.example/recibir");
    await setPushEnabled(true);
    const r = await flushOutbox(true, 500);
    expect(r.failed).toBe(0);
    expect(r.sent).toBeGreaterThanOrEqual(6);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer test-only-key");
    expect((await db.select().from(sigturOutbox).where(eq(sigturOutbox.status, "pending")))).toHaveLength(0);

    // SIGTUR down: kept with the error, to retry later.
    await queueChanges([{ establishmentId: e.id, field: "propietario", label: "Dueño / responsable", from: null, to: "Juan" }], agent, "Llamada");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 503 })));
    expect(await flushOutbox(true)).toEqual({ sent: 0, failed: 1 });
    const [failed] = await db.select().from(sigturOutbox).where(eq(sigturOutbox.status, "error"));
    expect(failed).toMatchObject({ attempts: 1, lastError: "SIGTUR respondió 503" });
    await setPushEnabled(false);
    vi.unstubAllEnvs();
  });
});
