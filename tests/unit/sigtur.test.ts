import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { apiKeys, callAttempts, callResults, campaigns, companies, establishments, users } from "@/db/schema";
import {
  buildInteractions, createApiKey, keyFromRequest, parseCallRequest, parseSigturCampaign, receiveCallRequest, receiveSigturCampaign,
  requestsCampaign, requestsOverview, setAutoAssignees, setRequestsPaused,
} from "@/lib/sigtur";

const req = (key?: string) => new Request("http://x/api/integrations/sigtur/interactions", { headers: key ? { authorization: `Bearer ${key}` } : {} });

describe("SIGTUR integration", () => {
  it("accepts only a valid, unrevoked key and keeps only its fingerprint", async () => {
    const [admin] = await db.insert(users).values({ username: "sg.admin", name: "Admin", role: "admin", passwordHash: "x" }).returning();
    const key = await createApiKey("SIGTUR", admin.id);
    expect(key).toMatch(/^eys_/);
    const [row] = await db.select().from(apiKeys).where(eq(apiKeys.prefix, key.slice(0, 10)));
    expect(row.hash).not.toContain(key);
    expect(await keyFromRequest(req(key))).toMatchObject({ id: row.id });
    expect(await keyFromRequest(req())).toBeNull();
    expect(await keyFromRequest(req(`${key}x`))).toBeNull();
    await db.update(apiKeys).set({ revokedAt: "2026-10-22T00:00:00.000Z" }).where(eq(apiKeys.id, row.id));
    expect(await keyFromRequest(req(key))).toBeNull();
  });

  it("creates a request task, assigns it by workload, and flags an existing open task instead of duplicating", async () => {
    expect(parseCallRequest({ idSigtur: "S-1" })).toBe("Falta solicitadoPor");
    const [a1] = await db.insert(users).values({ username: "sg.a1", name: "Agente Uno", role: "agent", passwordHash: "x" }).returning();
    const [a2] = await db.insert(users).values({ username: "sg.a2", name: "Agente Dos", role: "agent", passwordHash: "x" }).returning();
    await requestsCampaign();
    await setAutoAssignees([a1.id, a2.id]);
    // a1 already has work, so the request goes to a2.
    const [busy] = await db.insert(campaigns).values({ name: "Ocupada", startDate: "2026-01-01", endDate: "2030-12-31", status: "active" }).returning();
    const [bt] = await db.insert(companies).values({ campaignId: busy.id, key: "sg-busy", status: "pending", assignedUserId: a1.id }).returning();
    await db.insert(establishments).values({ campaignId: busy.id, companyId: bt.id, sigturId: "SG-BUSY", nombreComercial: "Ocupada" });

    const r = parseCallRequest({ idSigtur: "SG-NEW", solicitadoPor: "María (Licencias)", motivo: "Confirmar operación", telefonos: ["809-555-0101"], nombreComercial: "Hotel Nuevo" });
    if (typeof r === "string") throw new Error(r);
    const res = await receiveCallRequest(r);
    expect(res).toMatchObject({ existing: false, campaign: "Solicitudes SIGTUR", assignedUserId: a2.id });
    const [task] = await db.select().from(companies).where(eq(companies.id, res.taskId));
    expect(task).toMatchObject({ sigturRequest: true, requestedBy: "María (Licencias)", requestReason: "Confirmar operación", status: "pending" });

    const again = parseCallRequest({ idSigtur: "SG-BUSY", solicitadoPor: "Pedro", motivo: "Urgente" });
    if (typeof again === "string") throw new Error(again);
    const res2 = await receiveCallRequest(again);
    expect(res2).toMatchObject({ existing: true, taskId: bt.id, assignedUserId: a1.id });
    const [flagged] = await db.select().from(companies).where(eq(companies.id, bt.id));
    expect(flagged).toMatchObject({ sigturRequest: true, requestedBy: "Pedro", campaignId: busy.id });
  });

  it("receives a SIGTUR campaign as a draft", async () => {
    expect(parseSigturCampaign({ nombre: "X" })).toMatch(/nombre/);
    const s = parseSigturCampaign({
      nombre: "Desde SIGTUR", fechaInicio: "2026-11-01", fechaFin: "2026-11-30", creadoPor: "Juan", referencia: "CAMP-1",
      establecimientos: [{ "ID SIGTUR": "SG-C1", "Nombre comercial": "Uno", "Teléfono": "809-555-0001" }, { "ID SIGTUR": "SG-C2", "Nombre comercial": "Dos" }],
    });
    if (typeof s === "string") throw new Error(s);
    const r = await receiveSigturCampaign(s);
    if ("error" in r) throw new Error(r.error);
    expect(r.campaign).toMatchObject({ status: "draft", source: "sigtur", sourceRef: "CAMP-1" });
    expect(r.inserted).toBe(2);
  });

  it("builds one interaction per call result with text results", async () => {
    const [ag] = await db.insert(users).values({ username: "sg.int", name: "Ana Llamadas", role: "agent", passwordHash: "x" }).returning();
    const [c] = await db.insert(campaigns).values({ name: "Interacciones", startDate: "2026-01-01", endDate: "2030-12-31", status: "active" }).returning();
    const [t] = await db.insert(companies).values({ campaignId: c.id, key: "sg-int", status: "followup" }).returning();
    const [e] = await db.insert(establishments).values({ campaignId: c.id, companyId: t.id, sigturId: "SG-INT", nombreComercial: "Interactivo", rut: "R-1" }).returning();
    const [a] = await db.insert(callAttempts).values({ campaignId: c.id, companyId: t.id, userId: ag.id, attemptNo: 1, calledAt: "2026-10-20T15:00:00.000Z", phoneNumber: "809-555-0002", spokeWith: "Luis", contacted: true }).returning();
    await db.insert(callResults).values({ attemptId: a.id, campaignId: c.id, establishmentId: e.id, code: "01", commitmentDate: "2026-11-05" });

    const items = await buildInteractions({ attemptId: a.id });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ idSigtur: "SG-INT", rut: "R-1", canal: "Llamada", realizadoPor: "Ana Llamadas", personaContactada: "Luis", fechaCompromiso: "2026-11-05" });
    expect(items[0].resultado).not.toMatch(/^\d+$/);
    expect((await buildInteractions({ idSigtur: "SG-INT", from: "2026-10-21" }))).toHaveLength(0);
  });

  it("pauses and resumes the permanent campaign without touching open tasks", async () => {
    const [admin] = await db.insert(users).values({ username: "sg.switch", name: "Admin Interruptor", role: "admin", passwordHash: "x" }).returning();
    const before = await requestsOverview();
    await setRequestsPaused(true, admin.id);
    const paused = await requestsOverview();
    expect(paused.campaign).toMatchObject({ requestsPaused: true, pausedBy: admin.id, status: "active" });
    expect(paused.pausedByName).toBe("Admin Interruptor");
    expect(paused.open).toBe(before.open);
    await setRequestsPaused(false, admin.id);
    expect((await requestsCampaign())).toMatchObject({ requestsPaused: false, pausedBy: null, pausedAt: null });
  });
});
