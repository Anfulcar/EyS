import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { campaigns, companies, establishments, qrCases, qrReports, users, type User } from "@/db/schema";
import {
  addStep, approveClose, atLeast, canSee, canWork, checkUploadToken, cleanCaseInput, createCase, DEFAULT_QR_SETTINGS, fileContent, findSigturParty, listCases, proposeClose, putFilePart,
  qrSettings, qrStats, refer, answerReferral, reopen, returnClose, saveQrSettings, startFile, uploadToken, businessDaysBetween, type CaseInput,
} from "@/lib/qr";
import { generateCaseReport } from "@/lib/qr-report";

let admin: User, sup: User, handler: User, other: User, reg: User, none: User;
const mkUser = async (username: string, role: string, qrLevel: string) => (await db.insert(users).values({ username, name: username, role, passwordHash: "x", qrLevel }).returning())[0];
const base: CaseInput = {
  type: "Queja", topic: "Cobro indebido", channel: "app", priority: "Media", subject: "Cobro doble", description: "Le cobraron dos veces.",
  party: { sigtur: false, name: "Tours Prueba" }, complainant: { anonymous: false, name: "Turista", email: "t@example.com" },
};

beforeAll(async () => {
  admin = await mkUser("qr.admin", "admin", "none");
  sup = await mkUser("qr.sup", "supervisor", "supervise");
  handler = await mkUser("qr.handler", "agent", "manage");
  other = await mkUser("qr.other", "agent", "manage");
  reg = await mkUser("qr.reg", "agent", "register");
  none = await mkUser("qr.none", "inspector", "none");
  const [c] = await db.insert(campaigns).values({ name: "QR", startDate: "2026-01-01", endDate: "2030-12-31", status: "active" }).returning();
  const [co] = await db.insert(companies).values({ campaignId: c.id, key: "RUT:QR-RUT-1", status: "pending" }).returning();
  await db.insert(establishments).values({ campaignId: c.id, companyId: co.id, sigturId: "QR-SIG-1", rut: "QR-RUT-1", nombreComercial: "Hotel Prueba", rnc: "130-1", estatusRnt: "Vencida", provincia: "La Altagracia" });
});

describe("«Quejas y reclamaciones»: permissions per level", () => {
  it("administrators always supervise; levels add up", () => {
    expect(atLeast(admin, "supervise")).toBe(true);
    expect(atLeast(none, "register")).toBe(false);
    expect(atLeast(reg, "register")).toBe(true);
    expect(atLeast(reg, "manage")).toBe(false);
  });

  it("«Registrar» sees only the cases they registered; handlers work only their assigned ones", async () => {
    const mine = await createCase(cleanCaseInput(base, DEFAULT_QR_SETTINGS) as CaseInput, reg);
    const assigned = await createCase(cleanCaseInput({ ...base, assignedUserId: handler.id }, DEFAULT_QR_SETTINGS) as CaseInput, sup);
    expect(canSee(reg, mine)).toBe(true);
    expect(canSee(reg, assigned)).toBe(false);
    expect((await listCases(reg, {})).map((c) => c.id)).toEqual([mine.id]);
    expect(canSee(other, mine)).toBe(true);
    expect(canWork(handler, assigned)).toBe(true);
    expect(canWork(other, assigned)).toBe(false);
    expect(canWork(sup, assigned)).toBe(true);
    expect(canWork(reg, mine)).toBe(false);
    expect(assigned.status).toBe("analisis");
  });
});

describe("a case from start to end", () => {
  it("numbers by year, deadlines from the settings, first attention, referral, closing approved by someone else, report", async () => {
    await saveQrSettings({ ...DEFAULT_QR_SETTINGS, sla: { ...DEFAULT_QR_SETTINGS.sla, Queja: { first: 1, resp: 5 } } });
    const s = await qrSettings();
    const c = await createCase(cleanCaseInput({ ...base, assignedUserId: handler.id }, s) as CaseInput, sup, s);
    expect(c.number).toMatch(/^QR-\d{4}-\d{4}$/);
    expect(businessDaysBetween(c.createdAt.slice(0, 10), c.due)).toBeGreaterThanOrEqual(4);
    await addStep(c.id, handler, "public", "Se llamó al establecimiento.");
    let [row] = await db.select().from(qrCases).where(eq(qrCases.id, c.id));
    expect(row.firstDoneAt).not.toBeNull();
    await refer(row, { institution: "Pro Consumidor", dueOn: null, note: null }, handler);
    [row] = await db.select().from(qrCases).where(eq(qrCases.id, c.id));
    expect(row.status).toBe("referida");
    const { caseDetail } = await import("@/lib/qr");
    const refId = (await caseDetail(c.id)).refs[0].id;
    expect(await answerReferral(row, refId, "Devolución hecha", handler)).toBe(true);
    [row] = await db.select().from(qrCases).where(eq(qrCases.id, c.id));
    await proposeClose(row, "Se devolvió el dinero.", null, sup);
    [row] = await db.select().from(qrCases).where(eq(qrCases.id, c.id));
    // Nobody approves the closing they proposed.
    expect(await approveClose(row, sup)).toBe(false);
    expect(await returnClose(row, "Falta el comprobante", admin)).toBe(true);
    [row] = await db.select().from(qrCases).where(eq(qrCases.id, c.id));
    await proposeClose(row, "Se devolvió el dinero (comprobante adjunto).", null, handler);
    [row] = await db.select().from(qrCases).where(eq(qrCases.id, c.id));
    expect(await approveClose(row, sup)).toBe(true);
    const rep = await generateCaseReport(c.id, "auto", sup.name);
    expect(rep?.version).toBe(1);
    const [pdf] = await db.select().from(qrReports).where(eq(qrReports.caseId, c.id));
    expect((pdf.pdf as Buffer).subarray(0, 4).toString()).toBe("%PDF");
    [row] = await db.select().from(qrCases).where(eq(qrCases.id, c.id));
    expect(row.status).toBe("cerrada");
    expect(canWork(sup, row)).toBe(false);
    expect(await reopen(row, "Nueva información", sup)).toBe(true);
    expect((await generateCaseReport(c.id, "request", sup.name))?.version).toBe(2);
  });

  it("links a case to a RUT found in the SIGTUR data, and refuses an unknown type or a case without a party", async () => {
    const p = await findSigturParty("qr-rut-1");
    expect(p).toMatchObject({ rut: "QR-RUT-1", name: "Hotel Prueba", rntStatus: "Vencida" });
    expect(cleanCaseInput({ ...base, type: "Otra cosa" }, DEFAULT_QR_SETTINGS)).toBe("type");
    expect(cleanCaseInput({ ...base, party: { sigtur: false, name: " " } }, DEFAULT_QR_SETTINGS)).toBe("party");
    expect((cleanCaseInput({ ...base, topic: "Inventado" }, DEFAULT_QR_SETTINGS) as CaseInput).topic).toBe("Otro");
  });
});

describe("proof files", () => {
  it("arrive in pieces, are complete only with every piece, and the short-lived permission names one case", async () => {
    const c = await createCase(cleanCaseInput(base, DEFAULT_QR_SETTINGS) as CaseInput, reg);
    const data = Buffer.alloc(2 * 1024 * 1024 + 10, 7);
    const { fileId, parts } = await startFile(c.id, { name: "foto.jpg", mime: "image/jpeg", size: data.length }, { id: reg.id, name: reg.name });
    expect(parts).toBe(2);
    expect((await putFilePart(fileId, 0, data.subarray(0, 2 * 1024 * 1024)))?.complete).toBe(false);
    expect(await fileContent(fileId)).toBeNull();
    expect((await putFilePart(fileId, 1, data.subarray(2 * 1024 * 1024)))?.complete).toBe(true);
    expect((await fileContent(fileId))?.data.length).toBe(data.length);
    expect(checkUploadToken(uploadToken(c.id))).toBe(c.id);
    expect(checkUploadToken(uploadToken(c.id).replace(/.$/, "x"))).toBeNull();
  });
});

describe("statistics", () => {
  it("counts received, closed on time and per type", async () => {
    const st = await qrStats({ days: 30, types: [] });
    // Four cases were created in this file; the reopened one counts as open again.
    expect(st.received).toBe(4);
    expect(st.byType.find((r) => r.type === "Queja")).toMatchObject({ received: 4, closed: 0 });
    expect(st.weeks.reduce((n, w) => n + w.n, 0)).toBe(4);
  });
});
