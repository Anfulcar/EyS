import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, like, or, sql, type SQL } from "drizzle-orm";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/db";
import { appMeta, establishments, qrCases, qrFileParts, qrFiles, qrReferrals, qrReports, qrSteps, users, type QrCase, type User } from "@/db/schema";
import { addBusinessDays, localDateOf, localDayEnd, localDayStart, nowIso, todayLocal } from "./dates";
import { many } from "./multi";

// «Quejas y reclamaciones»: a module separate from the call campaigns, with its own permissions per person
// (users.qrLevel; administrators always supervise).

export const QR_TYPES = ["Queja", "Reclamación", "Denuncia", "Sugerencia"] as const;
export const QR_STATUSES = ["recibida", "analisis", "referida", "espera", "porcerrar", "cerrada"] as const;
export const QR_CHANNELS = ["web", "sigtur", "app", "phone", "email", "office", "historic"] as const;
export const QR_PRIORITIES = ["Alta", "Media", "Baja"] as const;
// Channels a person can choose when registering a case in the app.
export const QR_MANUAL_CHANNELS = ["app", "phone", "email", "office"] as const;

const ORDER = { none: 0, register: 1, manage: 2, supervise: 3 } as const;
export type QrLevel = keyof typeof ORDER;

export function qrLevel(u: Pick<User, "role" | "qrLevel">): QrLevel {
  if (u.role === "admin") return "supervise";
  return (u.qrLevel in ORDER ? u.qrLevel : "none") as QrLevel;
}
export const atLeast = (u: Pick<User, "role" | "qrLevel">, min: QrLevel) => ORDER[qrLevel(u)] >= ORDER[min];
// Who sees a case: handlers and supervisors see every case; «Registrar» only the ones they registered.
export const canSee = (u: User, c: Pick<QrCase, "createdBy">) => atLeast(u, "manage") || c.createdBy === u.id;
// Who works a case: supervisors any; handlers the ones assigned to them.
export const canWork = (u: User, c: Pick<QrCase, "assignedUserId" | "status">) =>
  c.status !== "cerrada" && (atLeast(u, "supervise") || (qrLevel(u) === "manage" && c.assignedUserId === u.id));

// ---------- Settings («Configuración · Quejas y reclamaciones») ----------

export type QrSettings = {
  sla: Record<string, { first: number; resp: number }>;
  warnDays: number;
  topics: string[];
  institutions: string[];
  publicForm: boolean;
};
const SETTINGS_KEY = "qr_settings";
export const DEFAULT_QR_SETTINGS: QrSettings = {
  sla: { Queja: { first: 2, resp: 15 }, "Reclamación": { first: 2, resp: 15 }, Denuncia: { first: 1, resp: 10 }, Sugerencia: { first: 5, resp: 30 } },
  warnDays: 3,
  topics: ["Cobro indebido", "Calidad del servicio", "Operación sin licencia", "Seguridad", "Publicidad engañosa", "Trato inadecuado", "Trámite de licencia (SIGTUR)", "Otro"],
  institutions: ["Pro Consumidor", "Dirección de Licencias (MITUR)", "CESTUR (Policía Turística)", "Ayuntamiento", "Ministerio de Medio Ambiente"],
  publicForm: true,
};

export async function qrSettings(): Promise<QrSettings> {
  const [row] = await db.select().from(appMeta).where(eq(appMeta.key, SETTINGS_KEY));
  const v = row ? (JSON.parse(row.value) as Partial<QrSettings>) : {};
  return { ...DEFAULT_QR_SETTINGS, ...v, sla: { ...DEFAULT_QR_SETTINGS.sla, ...(v.sla ?? {}) } };
}

export async function saveQrSettings(s: QrSettings) {
  const value = JSON.stringify(s);
  await db.insert(appMeta).values({ key: SETTINGS_KEY, value }).onConflictDoUpdate({ target: appMeta.key, set: { value } });
}

// ---------- Business days ----------

// Business days from `from` to `to` (local days); negative when `to` is before `from`.
export function businessDaysBetween(from: string, to: string) {
  const a = new Date(`${from.slice(0, 10)}T12:00:00Z`);
  const b = new Date(`${to.slice(0, 10)}T12:00:00Z`);
  const sign = b >= a ? 1 : -1;
  let n = 0;
  const d = new Date(a);
  while (sign > 0 ? d < b : d > b) {
    d.setUTCDate(d.getUTCDate() + sign);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) n += sign;
  }
  return n;
}

export type Deadline = { left: number; tone: "ok" | "warn" | "late" | "closed" };
export function deadlineOf(c: Pick<QrCase, "due" | "status">, warnDays: number, today = todayLocal()): Deadline {
  if (c.status === "cerrada") return { left: 0, tone: "closed" };
  const left = businessDaysBetween(today, c.due);
  return { left, tone: left < 0 ? "late" : left <= warnDays ? "warn" : "ok" };
}

// ---------- RUT lookup (SIGTUR data loaded in the campaigns) ----------

export type PartyFromSigtur = { rut: string | null; sigturId: string; name: string; razon: string | null; rnc: string | null; rntStatus: string | null; province: string | null; municipality: string | null; address: string | null; phone: string | null; email: string | null };

export async function findSigturParty(key: string): Promise<PartyFromSigtur | null> {
  const k = key.trim();
  if (k.length < 2) return null;
  const [e] = await db
    .select()
    .from(establishments)
    .where(or(sql`upper(${establishments.rut}) = upper(${k})`, sql`upper(${establishments.sigturId}) = upper(${k})`))
    .orderBy(desc(establishments.id))
    .limit(1);
  if (!e) return null;
  return {
    rut: e.rut, sigturId: e.sigturId, name: e.nombreComercial ?? e.razonSocial ?? e.sigturId, razon: e.razonSocial, rnc: e.rnc, rntStatus: e.estatusSigturActualizado ?? e.estatusRnt,
    province: e.provincia, municipality: e.municipio, address: e.direccion, phone: e.telefono, email: e.correoActualizado ?? e.correo,
  };
}

// ---------- Cases ----------

export type CaseInput = {
  type: string; topic: string | null; channel: string; priority: string; subject: string; description: string;
  party: { sigtur: boolean; rut?: string | null; sigturId?: string | null; name: string; razon?: string | null; rnc?: string | null; rntStatus?: string | null; province?: string | null; municipality?: string | null; address?: string | null; phone?: string | null; email?: string | null };
  complainant: { anonymous: boolean; name?: string | null; doc?: string | null; nationality?: string | null; phone?: string | null; email?: string | null };
  assignedUserId?: number | null; sourceRef?: string | null; senderHash?: string | null;
};

const clip = (v: string | null | undefined, n = 300) => {
  const s = (v ?? "").trim();
  return s ? s.slice(0, n) : null;
};

// Checks and cleans what arrives from a screen, the public form or SIGTUR; returns an error text when it can't be used.
export function cleanCaseInput(raw: CaseInput, s: QrSettings): CaseInput | string {
  if (!(QR_TYPES as readonly string[]).includes(raw.type)) return "type";
  if (!(QR_CHANNELS as readonly string[]).includes(raw.channel)) return "channel";
  const subject = clip(raw.subject, 200), description = clip(raw.description, 5000);
  if (!subject || !description) return "subject";
  const party = raw.party;
  const name = clip(party?.name, 200);
  if (!name) return "party";
  const topic = clip(raw.topic, 100);
  return {
    type: raw.type, channel: raw.channel, subject, description,
    topic: topic && s.topics.includes(topic) ? topic : topic ? "Otro" : null,
    priority: (QR_PRIORITIES as readonly string[]).includes(raw.priority) ? raw.priority : "Media",
    party: {
      sigtur: !!party.sigtur, rut: clip(party.rut, 40), sigturId: clip(party.sigturId, 40), name, razon: clip(party.razon, 200), rnc: clip(party.rnc, 40), rntStatus: clip(party.rntStatus, 60),
      province: clip(party.province, 100), municipality: clip(party.municipality, 100), address: clip(party.address), phone: clip(party.phone, 60), email: clip(party.email, 200),
    },
    complainant: raw.complainant?.anonymous
      ? { anonymous: true }
      : { anonymous: false, name: clip(raw.complainant?.name, 200), doc: clip(raw.complainant?.doc, 60), nationality: clip(raw.complainant?.nationality, 60), phone: clip(raw.complainant?.phone, 60), email: clip(raw.complainant?.email, 200) },
    assignedUserId: raw.assignedUserId ?? null, sourceRef: clip(raw.sourceRef, 120), senderHash: raw.senderHash ?? null,
  };
}

const CHANNEL_TEXT: Record<string, string> = { web: "Formulario web", sigtur: "SIGTUR", app: "Registrado en la aplicación", phone: "Teléfono", email: "Correo", office: "Presencial", historic: "Carga histórica" };
export const channelText = (c: string) => CHANNEL_TEXT[c] ?? c;

export async function createCase(input: CaseInput, by: { id: number; name: string } | null, s?: QrSettings) {
  const settings = s ?? (await qrSettings());
  const sla = settings.sla[input.type] ?? { first: 2, resp: 15 };
  const today = todayLocal();
  const year = Number(today.slice(0, 4));
  // Numbers per year; retried if two cases arrive at the same moment.
  for (let attempt = 0; attempt < 5; attempt++) {
    const [{ max }] = await db.select({ max: sql<number>`coalesce(max(${qrCases.seq}), 0)` }).from(qrCases).where(eq(qrCases.year, year));
    const seq = Number(max) + 1 + attempt;
    const number = `QR-${year}-${String(seq).padStart(4, "0")}`;
    try {
      const p = input.party, c = input.complainant;
      const [row] = await db
        .insert(qrCases)
        .values({
          number, year, seq, type: input.type, topic: input.topic, channel: input.channel, priority: input.priority, status: input.assignedUserId ? "analisis" : "recibida",
          assignedUserId: input.assignedUserId ?? null, createdBy: by?.id ?? null, firstDue: addBusinessDays(today, sla.first), due: addBusinessDays(today, sla.resp),
          subject: input.subject, description: input.description,
          partySigtur: p.sigtur, partyRut: p.rut, partySigturId: p.sigturId, partyName: p.name, partyRazon: p.razon, partyRnc: p.rnc, partyRntStatus: p.rntStatus,
          partyProvince: p.province, partyMunicipality: p.municipality, partyAddress: p.address, partyPhone: p.phone, partyEmail: p.email,
          complainantAnonymous: c.anonymous, complainantName: c.name, complainantDoc: c.doc, complainantNationality: c.nationality, complainantPhone: c.phone, complainantEmail: c.email,
          sourceRef: input.sourceRef, senderHash: input.senderHash,
        })
        .returning();
      await addStep(row.id, by, "system", by ? `Caso registrado por ${by.name} (${channelText(input.channel)}).` : `Caso recibido por ${channelText(input.channel)}.`);
      if (input.assignedUserId) {
        const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, input.assignedUserId));
        if (u) await addStep(row.id, by, "system", `Asignado a ${u.name}.`);
      }
      return row;
    } catch (e) {
      if (!String(e).includes("UNIQUE") || attempt === 4) throw e;
    }
  }
  throw new Error("number");
}

export async function addStep(caseId: number, by: { id: number; name: string } | null, kind: "public" | "internal" | "system", text: string) {
  await db.insert(qrSteps).values({ caseId, userId: by?.id ?? null, byName: by?.name ?? "Sistema", kind, text: text.slice(0, 5000) });
  const patch: Partial<QrCase> = { updatedAt: nowIso() };
  // The first step a person writes counts as the case's first attention.
  if (by && kind !== "system") {
    const [c] = await db.select({ firstDoneAt: qrCases.firstDoneAt, status: qrCases.status }).from(qrCases).where(eq(qrCases.id, caseId));
    if (c && !c.firstDoneAt) patch.firstDoneAt = nowIso();
    if (c?.status === "recibida") patch.status = "analisis";
  }
  await db.update(qrCases).set(patch).where(eq(qrCases.id, caseId));
}

export type CaseFilters = { status?: string; type?: string; channel?: string; topic?: string; assigned?: string; q?: string; rut?: string; from?: string; to?: string };

// The list a person may see, with the filters of «Casos» (several choices per filter, as everywhere).
export function caseWhere(u: User, f: CaseFilters, today = todayLocal(), warnDays = 3): SQL[] {
  const w: SQL[] = [];
  if (!atLeast(u, "manage")) w.push(eq(qrCases.createdBy, u.id));
  const st = many(f.status);
  const conds: SQL[] = [];
  for (const s of st) {
    if (s === "open") conds.push(sql`${qrCases.status} <> 'cerrada'`);
    else if (s === "late") conds.push(and(sql`${qrCases.status} <> 'cerrada'`, sql`${qrCases.due} < ${today}`)!);
    else if (s === "soon") conds.push(and(sql`${qrCases.status} <> 'cerrada'`, sql`${qrCases.due} >= ${today}`, sql`${qrCases.due} <= ${addBusinessDays(today, warnDays)}`)!);
    else if (s === "unassigned") conds.push(and(sql`${qrCases.status} <> 'cerrada'`, isNull(qrCases.assignedUserId))!);
    else if (s === "mine") conds.push(and(sql`${qrCases.status} <> 'cerrada'`, eq(qrCases.assignedUserId, u.id))!);
    else if ((QR_STATUSES as readonly string[]).includes(s)) conds.push(eq(qrCases.status, s));
  }
  if (conds.length) w.push(or(...conds)!);
  const types = many(f.type);
  if (types.length) w.push(inArray(qrCases.type, types));
  const channels = many(f.channel);
  if (channels.length) w.push(inArray(qrCases.channel, channels));
  const topics = many(f.topic);
  if (topics.length) w.push(inArray(qrCases.topic, topics));
  const who = many(f.assigned);
  if (who.length) {
    const ids = who.map(Number).filter((n) => n > 0);
    const any = [...(who.includes("me") ? [eq(qrCases.assignedUserId, u.id)] : []), ...(who.includes("none") ? [isNull(qrCases.assignedUserId)] : []), ...(ids.length ? [inArray(qrCases.assignedUserId, ids)] : [])];
    if (any.length) w.push(or(...any)!);
  }
  if (f.rut) w.push(eq(qrCases.partyRut, f.rut));
  if (f.from) w.push(gte(qrCases.createdAt, localDayStart(f.from)));
  if (f.to) w.push(sql`${qrCases.createdAt} <= ${localDayEnd(f.to)}`);
  if (f.q) {
    const q = `%${f.q.trim()}%`;
    w.push(or(like(qrCases.number, q), like(qrCases.subject, q), like(qrCases.partyName, q), like(qrCases.partyRut, q), like(qrCases.partySigturId, q), like(qrCases.complainantName, q))!);
  }
  return w;
}

export async function listCases(u: User, f: CaseFilters, limit = 200, offset = 0) {
  const s = await qrSettings();
  const w = caseWhere(u, f, todayLocal(), s.warnDays);
  return db.select().from(qrCases).where(w.length ? and(...w) : undefined).orderBy(sql`case when ${qrCases.status} = 'cerrada' then 1 else 0 end`, asc(qrCases.due), desc(qrCases.id)).limit(limit).offset(offset);
}

// Counters at the top of «Casos» (only what the person may see).
export async function caseCounters(u: User) {
  const s = await qrSettings();
  const today = todayLocal();
  const base = atLeast(u, "manage") ? undefined : eq(qrCases.createdBy, u.id);
  const n = (cond: SQL) => sql<number>`coalesce(sum(case when ${cond} then 1 else 0 end), 0)`;
  const open = sql`${qrCases.status} <> 'cerrada'`;
  const [r] = await db
    .select({
      open: n(open),
      late: n(sql`${open} and ${qrCases.due} < ${today}`),
      soon: n(sql`${open} and ${qrCases.due} >= ${today} and ${qrCases.due} <= ${addBusinessDays(today, s.warnDays)}`),
      unassigned: n(sql`${open} and ${qrCases.assignedUserId} is null`),
      toApprove: n(sql`${qrCases.status} = 'porcerrar'`),
      mine: n(sql`${open} and ${qrCases.assignedUserId} = ${u.id}`),
    })
    .from(qrCases)
    .where(base);
  return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Number(v)])) as Record<keyof typeof r, number>;
}

// The case if the person may see it, otherwise null (the screen answers "not found").
export async function caseFor(u: User, number: string) {
  const [c] = await db.select().from(qrCases).where(eq(qrCases.number, number));
  return c && canSee(u, c) ? c : null;
}

export async function caseDetail(caseId: number) {
  const [steps, refs, files, reports] = await Promise.all([
    db.select().from(qrSteps).where(eq(qrSteps.caseId, caseId)).orderBy(desc(qrSteps.at), desc(qrSteps.id)),
    db.select().from(qrReferrals).where(eq(qrReferrals.caseId, caseId)).orderBy(asc(qrReferrals.id)),
    db.select({ id: qrFiles.id, name: qrFiles.name, mime: qrFiles.mime, size: qrFiles.size, uploadedByName: qrFiles.uploadedByName, at: qrFiles.at, replacedAt: qrFiles.replacedAt })
      .from(qrFiles).where(and(eq(qrFiles.caseId, caseId), eq(qrFiles.complete, true))).orderBy(asc(qrFiles.id)),
    db.select({ id: qrReports.id, version: qrReports.version, origin: qrReports.origin, byName: qrReports.byName, createdAt: qrReports.createdAt }).from(qrReports).where(eq(qrReports.caseId, caseId)).orderBy(desc(qrReports.version)),
  ]);
  return { steps, refs, files, reports };
}

// Open tasks of the same RUT in the call campaigns (shown in the case summary).
export async function openCallTasksOfRut(rut: string) {
  const [r] = await db
    .select({ n: sql<number>`count(distinct ${establishments.companyId})` })
    .from(establishments)
    .where(and(eq(establishments.rut, rut), sql`exists (select 1 from companies c where c.id = ${establishments.companyId} and c.status not in ('done', 'transferred'))`));
  return Number(r.n);
}

export async function otherCasesOfRut(rut: string, exceptId: number) {
  const [r] = await db.select({ n: sql<number>`count(*)` }).from(qrCases).where(and(eq(qrCases.partyRut, rut), sql`${qrCases.id} <> ${exceptId}`));
  return Number(r.n);
}

export const STATUS_TEXT: Record<string, string> = { recibida: "Recibida", analisis: "En análisis", referida: "Referida", espera: "En espera de información", porcerrar: "Cierre por aprobar", cerrada: "Cerrada" };

export async function setStatus(c: QrCase, status: string, by: { id: number; name: string }) {
  if (!["recibida", "analisis", "referida", "espera"].includes(status) || c.status === status) return;
  await db.update(qrCases).set({ status, updatedAt: nowIso() }).where(eq(qrCases.id, c.id));
  await addStep(c.id, by, "system", `Estado: ${STATUS_TEXT[status]}.`);
}

export async function assign(c: QrCase, userId: number | null, by: { id: number; name: string }) {
  let name = "Sin asignar";
  if (userId) {
    const [u] = await db.select().from(users).where(eq(users.id, userId));
    if (!u || !u.active || !atLeast(u, "manage")) return false;
    name = u.name;
  }
  await db.update(qrCases).set({ assignedUserId: userId, status: c.status === "recibida" && userId ? "analisis" : c.status, updatedAt: nowIso() }).where(eq(qrCases.id, c.id));
  await addStep(c.id, by, "system", userId ? `Asignado a ${name}.` : "Sin asignar.");
  return true;
}

export async function refer(c: QrCase, r: { institution: string; dueOn: string | null; note: string | null }, by: { id: number; name: string }) {
  await db.insert(qrReferrals).values({ caseId: c.id, institution: r.institution.slice(0, 120), sentOn: todayLocal(), dueOn: r.dueOn, note: r.note, createdBy: by.id });
  await db.update(qrCases).set({ status: "referida", updatedAt: nowIso() }).where(eq(qrCases.id, c.id));
  await addStep(c.id, by, "public", `Referido a ${r.institution}${r.note ? `: ${r.note}` : "."}`);
}

export async function answerReferral(c: QrCase, referralId: number, response: string, by: { id: number; name: string }) {
  const [r] = await db.select().from(qrReferrals).where(and(eq(qrReferrals.id, referralId), eq(qrReferrals.caseId, c.id)));
  if (!r || r.response) return false;
  await db.update(qrReferrals).set({ response: response.slice(0, 3000), respondedAt: nowIso() }).where(eq(qrReferrals.id, r.id));
  if (c.status === "referida") await db.update(qrCases).set({ status: "analisis" }).where(eq(qrCases.id, c.id));
  await addStep(c.id, by, "public", `Respuesta de ${r.institution}: ${response}`);
  return true;
}

export async function proposeClose(c: QrCase, solution: string, note: string | null, by: { id: number; name: string }) {
  await db.update(qrCases).set({ solution: solution.slice(0, 5000), status: "porcerrar", closeProposedBy: by.id, closeProposedAt: nowIso(), closeNote: note, updatedAt: nowIso() }).where(eq(qrCases.id, c.id));
  await addStep(c.id, by, "system", `Cierre propuesto${note ? `: ${note}` : "."}`);
}

// Nobody approves the closing they proposed.
export async function approveClose(c: QrCase, by: { id: number; name: string }) {
  if (c.status !== "porcerrar" || c.closeProposedBy === by.id) return false;
  await db.update(qrCases).set({ status: "cerrada", closedBy: by.id, closedAt: nowIso(), updatedAt: nowIso() }).where(eq(qrCases.id, c.id));
  await addStep(c.id, by, "public", "Cierre aprobado. Caso cerrado.");
  return true;
}

export async function returnClose(c: QrCase, reason: string, by: { id: number; name: string }) {
  if (c.status !== "porcerrar") return false;
  await db.update(qrCases).set({ status: "analisis", closeProposedBy: null, closeProposedAt: null, closeNote: null, updatedAt: nowIso() }).where(eq(qrCases.id, c.id));
  await addStep(c.id, by, "internal", `Cierre devuelto: ${reason}`);
  return true;
}

export async function reopen(c: QrCase, reason: string, by: { id: number; name: string }) {
  if (c.status !== "cerrada") return false;
  await db.update(qrCases).set({ status: "analisis", closedAt: null, closedBy: null, closeProposedBy: null, closeProposedAt: null, updatedAt: nowIso() }).where(eq(qrCases.id, c.id));
  await addStep(c.id, by, "public", `Caso reabierto: ${reason}`);
  return true;
}

// ---------- Files («Pruebas») ----------

export const MAX_FILE = 8 * 1024 * 1024;
export const PART_SIZE = 2 * 1024 * 1024;
export const ALLOWED_FILE = /^(image\/(jpeg|png|webp|gif|heic|heif)|application\/pdf|audio\/(mpeg|mp4|ogg|wav|x-m4a)|video\/mp4|text\/plain|application\/(msword|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet)|vnd\.ms-excel))$/;

export async function startFile(caseId: number, f: { name: string; mime: string; size: number }, by: { id: number | null; name: string }) {
  const parts = Math.max(1, Math.ceil(f.size / PART_SIZE));
  const [row] = await db.insert(qrFiles).values({ caseId, name: f.name.slice(0, 200), mime: f.mime, size: f.size, parts, uploadedBy: by.id, uploadedByName: by.name }).returning({ id: qrFiles.id });
  return { fileId: row.id, parts };
}

// Stores one piece; when the last one arrives the file is complete and recorded in the case's steps.
export async function putFilePart(fileId: number, idx: number, data: Buffer) {
  const [f] = await db.select().from(qrFiles).where(eq(qrFiles.id, fileId));
  if (!f || f.complete || idx < 0 || idx >= f.parts || data.length > PART_SIZE) return null;
  await db.insert(qrFileParts).values({ fileId, idx, data }).onConflictDoNothing();
  const [{ n, bytes }] = await db.select({ n: sql<number>`count(*)`, bytes: sql<number>`coalesce(sum(length(${qrFileParts.data})), 0)` }).from(qrFileParts).where(eq(qrFileParts.fileId, fileId));
  if (Number(n) < f.parts) return { complete: false, file: f };
  if (Number(bytes) !== f.size) {
    await db.delete(qrFiles).where(eq(qrFiles.id, fileId));
    return null;
  }
  await db.update(qrFiles).set({ complete: true }).where(eq(qrFiles.id, fileId));
  await addStep(f.caseId, f.uploadedBy ? { id: f.uploadedBy, name: f.uploadedByName ?? "" } : null, "internal", `Prueba agregada: ${f.name}.`);
  return { complete: true, file: f };
}

export async function fileContent(fileId: number) {
  const [f] = await db.select().from(qrFiles).where(and(eq(qrFiles.id, fileId), eq(qrFiles.complete, true)));
  if (!f) return null;
  const parts = await db.select({ data: qrFileParts.data }).from(qrFileParts).where(eq(qrFileParts.fileId, fileId)).orderBy(asc(qrFileParts.idx));
  return { file: f, data: Buffer.concat(parts.map((p) => p.data as Buffer)) };
}

// A short-lived permission to add files to one case, for the public form (no account).
export function uploadToken(caseId: number, minutes = 30) {
  const exp = Date.now() + minutes * 60000;
  const sig = createHmac("sha256", process.env.AUTH_SECRET ?? "dev").update(`qr-upload:${caseId}:${exp}`).digest("base64url");
  return `${caseId}.${exp}.${sig}`;
}
export function checkUploadToken(token: string): number | null {
  const [id, exp, sig] = token.split(".");
  if (!id || !exp || !sig || Number(exp) < Date.now()) return null;
  const want = createHmac("sha256", process.env.AUTH_SECRET ?? "dev").update(`qr-upload:${id}:${exp}`).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b) ? Number(id) : null;
}
export const senderFingerprint = (ip: string) => createHash("sha256").update(`${process.env.AUTH_SECRET ?? "dev"}:${ip}`).digest("hex").slice(0, 32);

// Public form: at most a few cases per sender per hour.
export async function recentFromSender(hash: string) {
  const [r] = await db.select({ n: sql<number>`count(*)` }).from(qrCases).where(and(eq(qrCases.senderHash, hash), gte(qrCases.createdAt, new Date(Date.now() - 3600000).toISOString())));
  return Number(r.n);
}

// ---------- Statistics ----------

export async function qrStats(f: { days: number; types: string[] }) {
  const s = await qrSettings();
  const since = new Date(Date.now() - f.days * 86400000).toISOString();
  const w: SQL[] = [gte(qrCases.createdAt, since)];
  if (f.types.length) w.push(inArray(qrCases.type, f.types));
  const rows = await db.select().from(qrCases).where(and(...w));
  const people = await db.select({ id: users.id, name: users.name }).from(users);
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  const today = todayLocal();
  const closed = rows.filter((c) => c.status === "cerrada" && c.closedAt);
  const daysToClose = (c: QrCase) => businessDaysBetween(localDateOf(c.createdAt), localDateOf(c.closedAt!));
  const onTime = closed.filter((c) => localDateOf(c.closedAt!) <= c.due);
  const avg = (list: QrCase[]) => (list.length ? Math.round((list.reduce((t, c) => t + daysToClose(c), 0) / list.length) * 10) / 10 : null);
  const count = (key: (c: QrCase) => string | null) => {
    const m = new Map<string, number>();
    for (const c of rows) {
      const k = key(c);
      if (k) m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].map(([k, n]) => ({ key: k, n })).sort((a, b) => b.n - a.n);
  };
  // Received per week, last 12 weeks (whatever the period chosen).
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const end = new Date(Date.now() - (11 - i) * 7 * 86400000);
    const start = new Date(end.getTime() - 7 * 86400000);
    return { start: start.toISOString(), end: end.toISOString(), n: 0 };
  });
  const weekRows = await db.select({ createdAt: qrCases.createdAt, type: qrCases.type }).from(qrCases).where(gte(qrCases.createdAt, weeks[0].start));
  for (const r of weekRows) {
    if (f.types.length && !f.types.includes(r.type)) continue;
    const wk = weeks.find((x) => r.createdAt > x.start && r.createdAt <= x.end);
    if (wk) wk.n++;
  }
  const byType = QR_TYPES.filter((t) => !f.types.length || f.types.includes(t)).map((t) => {
    const all = rows.filter((c) => c.type === t), cl = closed.filter((c) => c.type === t), ok = onTime.filter((c) => c.type === t);
    return { type: t, received: all.length, open: all.length - cl.length, closed: cl.length, avgDays: avg(cl), onTimePct: cl.length ? Math.round((ok.length / cl.length) * 100) : null, sla: s.sla[t]?.resp ?? null };
  });
  const handlers = new Map<number, QrCase[]>();
  for (const c of rows) if (c.assignedUserId) handlers.set(c.assignedUserId, [...(handlers.get(c.assignedUserId) ?? []), c]);
  return {
    received: rows.length,
    open: rows.length - closed.length,
    closed: closed.length,
    onTimePct: closed.length ? Math.round((onTime.length / closed.length) * 100) : null,
    onTime: onTime.length,
    avgDays: avg(closed),
    late: rows.filter((c) => c.status !== "cerrada" && c.due < today).length,
    weeks,
    byTopic: count((c) => c.topic ?? "Sin tema"),
    byChannel: count((c) => c.channel),
    byType,
    byRut: count((c) => c.partyRut).slice(0, 8).map((r) => ({ ...r, name: rows.find((c) => c.partyRut === r.key)?.partyName ?? "" })),
    byHandler: [...handlers.entries()].map(([id, list]) => {
      const cl = list.filter((c) => c.status === "cerrada" && c.closedAt);
      return { id, name: nameOf.get(id) ?? "—", open: list.length - cl.length, late: list.filter((c) => c.status !== "cerrada" && c.due < today).length, closed: cl.length, avgDays: avg(cl) };
    }).sort((a, b) => b.open - a.open),
  };
}

export async function handlers() {
  const list = await db.select().from(users).where(eq(users.active, true)).orderBy(asc(users.name));
  return list.filter((u) => atLeast(u, "manage")).map((u) => ({ id: u.id, name: u.name }));
}
