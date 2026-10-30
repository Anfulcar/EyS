import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { callAttempts, campaigns, companies, dataChanges, establishments, users, type User } from "@/db/schema";
import { changeCounts, changeRows, markSigturDone } from "@/lib/changes";
import { queueChanges } from "@/lib/sigtur-push";
import { idsByFilters } from "@/lib/remove";
import { transferToNewCampaign } from "@/lib/transfer";
import { logCall, logVisit } from "@/lib/workflow";

let admin: User, agent: User, campaignId: number;
const task = async (key: string, correo: string | null) => {
  const [c] = await db.insert(companies).values({ campaignId, key, status: "pending", assignedUserId: agent.id }).returning();
  const [e] = await db.insert(establishments).values({ campaignId, companyId: c.id, sigturId: key, rut: `R-${key}`, nombreComercial: key, correo, correoValido: correo ? "Sí" : null, correoRebotado: correo ? "Sí" : null }).returning();
  return { c, e };
};
const call = (companyId: number, establishmentId: number, extra: { updatedEmail?: string | null; emailReceived?: string | null }) => ({
  companyId, phoneId: null, calledAt: "2026-10-30T14:00:00.000Z", contacted: true, attended: true, noContactCode: null,
  spokeWith: "Dueño", spokeRole: null, isResponsible: true, whatsappSent: false, notes: null, updatedEmail: null, ...extra,
  results: [{ establishmentId, code: "03", enOperacion: "Sí" }],
});

beforeAll(async () => {
  [admin] = await db.insert(users).values({ username: "em.admin", name: "Admin Correo", role: "admin", passwordHash: "x" }).returning();
  [agent] = await db.insert(users).values({ username: "em.agente", name: "Ana Correo", role: "agent", passwordHash: "x" }).returning();
  const [c] = await db.insert(campaigns).values({ name: "Correos", startDate: "2026-01-01", endDate: "2030-12-31", status: "active" }).returning();
  campaignId = c.id;
});

describe("email: corrected address, «¿Recibió el correo?», change report, email campaigns", () => {
  it("the call keeps the answer and the corrected email (the old bounce no longer applies)", async () => {
    const { c, e } = await task("em-1", "viejo@example.com");
    const o = await logCall(agent, call(c.id, e.id, { updatedEmail: "nuevo@example.com", emailReceived: "No" }));
    const [a] = await db.select().from(callAttempts).where(eq(callAttempts.id, o.attemptId));
    expect(a.emailReceived).toBe("No");
    const [after] = await db.select().from(establishments).where(eq(establishments.id, e.id));
    expect(after).toMatchObject({ correoActualizado: "nuevo@example.com", correoRecibido: "No", correoRebotado: null, correo: "viejo@example.com" });
    // The call also records «¿En operación?»; the email is one more change.
    expect(o.changes).toContainEqual(expect.objectContaining({ field: "correo", from: "viejo@example.com", to: "nuevo@example.com" }));
    // What the server does after the call: SIGTUR queue + «Reporte de cambios».
    await queueChanges(o.changes, agent, "Llamada");
    const rows = await changeRows({ q: "R-em-1", field: "correo" }, 10);
    expect(rows).toEqual([expect.objectContaining({ field: "correo", fromValue: "viejo@example.com", toValue: "nuevo@example.com", byName: "Ana Correo", source: "Llamada", rut: "R-em-1", campaignName: "Correos", sigturDoneAt: null })]);
  });

  it("an answer is only kept when someone was reached; anything but Sí/No is ignored", async () => {
    const { c, e } = await task("em-2", "dos@example.com");
    const o = await logCall(agent, { ...call(c.id, e.id, { emailReceived: "Quizás" }) });
    const [a] = await db.select().from(callAttempts).where(eq(callAttempts.id, o.attemptId));
    expect(a.emailReceived).toBeNull();
  });

  it("the visit's «Nuevo correo» is a change too", async () => {
    const { e } = await task("em-3", "tres@example.com");
    const v = await logVisit(admin, { establishmentId: e.id, visitDate: "2026-10-30", code: "V6", commitmentDate: null, notes: null, newEmail: "tres.nuevo@example.com" });
    expect(v.changes).toContainEqual(expect.objectContaining({ field: "correo", to: "tres.nuevo@example.com" }));
    const [after] = await db.select().from(establishments).where(eq(establishments.id, e.id));
    expect(after.correoActualizado).toBe("tres.nuevo@example.com");
  });

  it("filters by «¿Recibió el correo?» (several choices)", async () => {
    expect(await idsByFilters(campaignId, { mail: "no" })).toHaveLength(1);
    expect(await idsByFilters(campaignId, { mail: "none" })).toHaveLength(2);
    expect(await idsByFilters(campaignId, { mail: "no|none" })).toHaveLength(3);
  });

  it("an email campaign copies the tasks with the corrected email and leaves the originals open", async () => {
    const [from] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId));
    const r = await transferToNewCampaign(from, { statuses: ["pending", "retry", "followup", "visit", "done"], mail: "no" }, { name: "Reenvío", description: "", startDate: "2026-11-01", endDate: "2026-12-31", maxAttempts: 3, followupDays: 5 }, admin.id, "email");
    expect(r?.count).toBe(1);
    expect(r?.campaign.kind).toBe("email");
    const [copy] = await db.select().from(establishments).where(eq(establishments.campaignId, r!.campaign.id));
    expect(copy).toMatchObject({ correoActualizado: "nuevo@example.com", correoEnviadoFecha: null, correoRebotado: null });
    const originals = await db.select().from(companies).where(eq(companies.campaignId, campaignId));
    expect(originals.some((c) => c.status === "transferred")).toBe(false);
    // Its tasks are never called.
    const [ct] = await db.select().from(companies).where(eq(companies.campaignId, r!.campaign.id));
    await expect(logCall(admin, call(ct.id, copy.id, {}))).rejects.toThrow("Not found");
  });

  it("changes are marked once as updated in SIGTUR", async () => {
    const before = await changeCounts({ campaign: String(campaignId) });
    expect(before.pending).toBe(before.total);
    const ids = (await db.select({ id: dataChanges.id }).from(dataChanges).where(eq(dataChanges.campaignId, campaignId))).map((r) => r.id);
    expect(await markSigturDone(ids, admin)).toBe(ids.length);
    expect(await markSigturDone(ids, agent)).toBe(0);
    expect(await changeCounts({ campaign: String(campaignId), state: "pending" })).toMatchObject({ total: 0 });
    const [row] = await changeRows({ campaign: String(campaignId), state: "done" }, 1);
    expect(row.sigturDoneByName).toBe("Admin Correo");
  });
});
