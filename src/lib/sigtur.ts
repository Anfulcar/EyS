import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, asc, eq, gte, inArray, isNull, lte, ne, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, callAttempts, callResults, campaigns, companies, establishments, integrationLog, users, visits } from "@/db/schema";
import { CLOSED_STATUSES, codeLabel, label, MATRIX_COLUMNS, OBSTACLES } from "./catalog";
import { localDayEnd, localDayStart, nowIso, todayLocal } from "./dates";
import { buildRecords, commitImport, companyKey } from "./importer";
import { absentOn, distribute, establishmentCounts, workload } from "./team";

// ---------- Keys («Integraciones») ----------

const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

// The full key is shown once; only its hash is kept.
export async function createApiKey(name: string, createdBy: number) {
  const key = `eys_${randomBytes(24).toString("base64url")}`;
  await db.insert(apiKeys).values({ name, prefix: key.slice(0, 10), hash: hashKey(key), createdBy });
  return key;
}

// The key sent by SIGTUR ("Authorization: Bearer <key>"), or null when missing, wrong or revoked.
export async function keyFromRequest(req: Request) {
  const raw = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!raw || raw.length < 20) return null;
  const [k] = await db.select().from(apiKeys).where(and(eq(apiKeys.hash, hashKey(raw)), isNull(apiKeys.revokedAt)));
  if (!k) return null;
  await db.update(apiKeys).set({ lastUsedAt: nowIso() }).where(eq(apiKeys.id, k.id));
  return k;
}

export async function logIntegration(keyId: number | null, kind: string, ok: boolean, summary: string) {
  await db.insert(integrationLog).values({ keyId, kind, ok, summary: summary.slice(0, 500) });
}

// ---------- Call requests (always-open campaign «Solicitudes SIGTUR») ----------

export const REQUESTS_CAMPAIGN = "Solicitudes SIGTUR";

export async function requestsCampaign() {
  const found = await db.query.campaigns.findFirst({ where: eq(campaigns.kind, "sigtur_requests") });
  if (found) return found;
  const [c] = await db
    .insert(campaigns)
    .values({ name: REQUESTS_CAMPAIGN, description: "Llamadas solicitadas desde SIGTUR. Siempre abierta.", kind: "sigtur_requests", source: "sigtur", status: "active", startDate: todayLocal(), endDate: "2099-12-31" })
    .returning();
  return c;
}

export const PAUSED_MESSAGE = "Solicitudes de llamada en pausa. Intente más tarde o comuníquese con el equipo de campañas.";

// Switched on/off by administrators («Campañas» or «Integraciones»). Only new requests stop; open tasks keep going.
export async function setRequestsPaused(paused: boolean, userId: number) {
  const c = await requestsCampaign();
  await db
    .update(campaigns)
    .set(paused ? { requestsPaused: true, pausedBy: userId, pausedAt: nowIso() } : { requestsPaused: false, pausedBy: null, pausedAt: null })
    .where(eq(campaigns.id, c.id));
}

// Numbers for the «Campaña permanente» block.
export async function requestsOverview() {
  const c = await requestsCampaign();
  const since = localDayStart(todayLocal());
  const [[counts], [today], people] = await Promise.all([
    db
      .select({
        open: sql<number>`coalesce(sum(case when ${companies.status} in ('done','transferred') then 0 else 1 end), 0)`,
        done: sql<number>`coalesce(sum(case when ${companies.status} = 'done' then 1 else 0 end), 0)`,
      })
      .from(companies)
      .where(eq(companies.campaignId, c.id)),
    db.select({ n: sql<number>`count(*)` }).from(companies).where(and(eq(companies.sigturRequest, true), gte(companies.requestedAt, since))),
    db.select({ id: users.id, name: users.name }).from(users),
  ]);
  const names = new Map(people.map((u) => [u.id, u.name]));
  const chosen: number[] = c.autoAssignees ? JSON.parse(c.autoAssignees) : [];
  return {
    campaign: c,
    open: Number(counts.open), done: Number(counts.done), today: Number(today.n),
    assignees: chosen.map((id) => names.get(id)).filter((n): n is string => !!n),
    pausedByName: c.pausedBy ? names.get(c.pausedBy) ?? null : null,
  };
}

export type CallRequest = {
  idSigtur: string;
  solicitadoPor: string;
  motivo: string;
  rut?: string;
  nombreComercial?: string;
  razonSocial?: string;
  rnc?: string;
  telefonos?: string[];
  correo?: string;
  provincia?: string;
  municipio?: string;
  zonaOperativa?: string;
  prioridad?: string;
  estatusRnt?: string;
};

const clean = (v: unknown, max = 200) => (v == null ? "" : String(v).trim().slice(0, max));

export function parseCallRequest(body: unknown): CallRequest | string {
  const b = (body ?? {}) as Record<string, unknown>;
  const idSigtur = clean(b.idSigtur, 40);
  const solicitadoPor = clean(b.solicitadoPor, 120);
  const motivo = clean(b.motivo, 1000);
  if (!idSigtur) return "Falta idSigtur";
  if (!solicitadoPor) return "Falta solicitadoPor";
  if (!motivo) return "Falta motivo";
  const telefonos = Array.isArray(b.telefonos) ? b.telefonos.map((x) => clean(x, 40)).filter(Boolean).slice(0, 10) : [];
  const opt = (k: string) => clean(b[k]) || undefined;
  return { idSigtur, solicitadoPor, motivo, telefonos, rut: opt("rut"), nombreComercial: opt("nombreComercial"), razonSocial: opt("razonSocial"), rnc: opt("rnc"), correo: opt("correo"), provincia: opt("provincia"), municipio: opt("municipio"), zonaOperativa: opt("zonaOperativa"), prioridad: opt("prioridad"), estatusRnt: opt("estatusRnt") };
}

// A request for an establishment that already has an open task flags that task; otherwise a new task is
// created in «Solicitudes SIGTUR» and given to whoever has the least work among the chosen people.
export async function receiveCallRequest(r: CallRequest) {
  const flag = { sigturRequest: true, requestedBy: r.solicitadoPor, requestReason: r.motivo, requestedAt: nowIso(), nextActionAt: null };
  const [open] = await db
    .select({ id: companies.id, campaignName: campaigns.name, assignedUserId: companies.assignedUserId })
    .from(establishments)
    .innerJoin(companies, eq(companies.id, establishments.companyId))
    .innerJoin(campaigns, eq(campaigns.id, companies.campaignId))
    .where(and(eq(establishments.sigturId, r.idSigtur), ne(campaigns.status, "closed"), notInArray(companies.status, CLOSED_STATUSES)))
    .limit(1);
  if (open) {
    await db.update(companies).set(flag).where(eq(companies.id, open.id));
    return { taskId: open.id, campaign: open.campaignName, assignedUserId: open.assignedUserId, existing: true };
  }

  const c = await requestsCampaign();
  const row: Record<string, unknown> = {
    "ID SIGTUR": r.idSigtur, RUT: r.rut, "Nombre comercial": r.nombreComercial ?? r.razonSocial ?? r.idSigtur, "Razón social": r.razonSocial,
    "RNC / Cédula": r.rnc, "Teléfono": r.telefonos?.join(" / "), Correo: r.correo, Provincia: r.provincia, Municipio: r.municipio,
    "Zona operativa": r.zonaOperativa, Prioridad: r.prioridad, "Estatus RNT": r.estatusRnt,
  };
  const headers = Object.keys(row).filter((k) => row[k] != null && row[k] !== "");
  const b = buildRecords(headers, [Object.fromEntries(headers.map((h) => [h, row[h]]))] as never);
  await commitImport(c.id, b.records, new Set(MATRIX_COLUMNS.filter((m) => m.field && headers.includes(m.header)).map((m) => m.field!)));
  const [task] = await db.select().from(companies).where(and(eq(companies.campaignId, c.id), eq(companies.key, companyKey(b.records[0]))));
  // Closed earlier (e.g. done last month): a new request opens it again.
  await db.update(companies).set({ ...flag, status: CLOSED_STATUSES.includes(task.status) ? "pending" : task.status }).where(eq(companies.id, task.id));
  let assignedUserId = task.assignedUserId;
  if (!assignedUserId) {
    const chosen: number[] = c.autoAssignees ? JSON.parse(c.autoAssignees) : [];
    const absent = await absentOn();
    const people = chosen.filter((id) => !absent.has(id));
    if (people.length) {
      const size = await establishmentCounts([task.id]);
      const pick = distribute([task], people, size, await workload(people));
      assignedUserId = pick.get(task.id) ?? null;
      if (assignedUserId) await db.update(companies).set({ assignedUserId, assignedAt: nowIso() }).where(eq(companies.id, task.id));
    }
  }
  return { taskId: task.id, campaign: c.name, assignedUserId, existing: false };
}

// ---------- Campaigns created in SIGTUR (arrive as «Borrador») ----------

export type SigturCampaign = {
  nombre: string;
  descripcion?: string;
  fechaInicio: string;
  fechaFin: string;
  intentosMaximos?: number;
  diasSeguimiento?: number;
  guion?: string;
  creadoPor: string;
  referencia?: string;
  establecimientos: Record<string, unknown>[];
};

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

export function parseSigturCampaign(body: unknown): SigturCampaign | string {
  const b = (body ?? {}) as Record<string, unknown>;
  const nombre = clean(b.nombre, 120);
  const fechaInicio = clean(b.fechaInicio, 10);
  const fechaFin = clean(b.fechaFin, 10);
  const creadoPor = clean(b.creadoPor, 120);
  if (nombre.length < 3) return "Falta nombre (mínimo 3 letras)";
  if (!isDate(fechaInicio) || !isDate(fechaFin) || fechaFin < fechaInicio) return "Fechas inválidas: use AAAA-MM-DD y fechaFin ≥ fechaInicio";
  if (!creadoPor) return "Falta creadoPor";
  if (!Array.isArray(b.establecimientos) || b.establecimientos.length === 0) return "Falta la lista de establecimientos";
  if (b.establecimientos.length > 20000) return "Máximo 20 000 establecimientos por envío";
  const num = (v: unknown, def: number, max: number) => Math.min(max, Math.max(1, Math.round(Number(v) || def)));
  return {
    nombre, fechaInicio, fechaFin, creadoPor,
    descripcion: clean(b.descripcion, 2000) || undefined,
    intentosMaximos: num(b.intentosMaximos, 3, 10),
    diasSeguimiento: num(b.diasSeguimiento, 5, 30),
    guion: clean(b.guion, 10000) || undefined,
    referencia: clean(b.referencia, 100) || undefined,
    establecimientos: b.establecimientos as Record<string, unknown>[],
  };
}

export async function receiveSigturCampaign(s: SigturCampaign) {
  const headers = [...new Set(s.establecimientos.flatMap((r) => Object.keys(r ?? {})))];
  const b = buildRecords(headers, s.establecimientos as never);
  if (b.missing.length) return { error: `Faltan columnas obligatorias: ${b.missing.join(", ")}` };
  const [c] = await db
    .insert(campaigns)
    .values({
      name: s.nombre, description: s.descripcion ?? `Creada en SIGTUR por ${s.creadoPor}`, startDate: s.fechaInicio, endDate: s.fechaFin,
      maxAttempts: s.intentosMaximos ?? 3, followupDays: s.diasSeguimiento ?? 5, scriptEs: s.guion ?? null,
      status: "draft", source: "sigtur", sourceRef: s.referencia ?? null,
    })
    .returning();
  const mapped = new Set<string>();
  for (const target of Object.values(b.mapping)) {
    const f = MATRIX_COLUMNS.find((m) => m.header === target)?.field;
    if (f) mapped.add(f);
  }
  const r = await commitImport(c.id, b.records, mapped);
  return { campaign: c, inserted: r.inserted, companies: r.companies, skipped: b.errors.length, errors: b.errors.slice(0, 20) };
}

// ---------- Interactions (one per call result, visit and email) ----------

export type Interaction = {
  id: string;
  idSigtur: string;
  rut: string | null;
  nombreComercial: string | null;
  fechaHora: string;
  canal: "Llamada" | "Visita" | "Correo";
  direccion: "Saliente" | "Entrante";
  realizadoPor: string | null;
  numeroMarcado: string | null;
  personaContactada: string | null;
  cargo: string | null;
  resultado: string;
  fechaCompromiso: string | null;
  obstaculo: string | null;
  notas: string | null;
  campana: string;
  solicitudSigtur: boolean;
  solicitadoPor: string | null;
};

export type InteractionFilter = { from?: string; to?: string; idSigtur?: string; attemptId?: number; limit?: number; offset?: number };

export async function buildInteractions(f: InteractionFilter): Promise<Interaction[]> {
  const fromIso = f.from ? localDayStart(f.from) : "";
  const toIso = f.to ? localDayEnd(f.to) : "9999";
  const people = new Map((await db.select({ id: users.id, name: users.name }).from(users)).map((u) => [u.id, u.name]));
  const estW = f.idSigtur ? [eq(establishments.sigturId, f.idSigtur)] : [];

  const calls = await db
    .select({ r: callResults, a: callAttempts, e: { sigturId: establishments.sigturId, rut: establishments.rut, nombre: establishments.nombreComercial }, campaign: campaigns.name, c: { sigturRequest: companies.sigturRequest, requestedBy: companies.requestedBy } })
    .from(callResults)
    .innerJoin(callAttempts, eq(callAttempts.id, callResults.attemptId))
    .innerJoin(establishments, eq(establishments.id, callResults.establishmentId))
    .innerJoin(campaigns, eq(campaigns.id, callAttempts.campaignId))
    .innerJoin(companies, eq(companies.id, callAttempts.companyId))
    .where(and(gte(callAttempts.calledAt, fromIso), lte(callAttempts.calledAt, toIso), ...(f.attemptId ? [eq(callAttempts.id, f.attemptId)] : []), ...estW));
  const out: Interaction[] = calls.map(({ r, a, e, campaign, c }) => ({
    id: `llamada-${r.id}`,
    idSigtur: e.sigturId, rut: e.rut, nombreComercial: e.nombre,
    fechaHora: a.calledAt, canal: "Llamada", direccion: "Saliente",
    realizadoPor: people.get(a.userId) ?? null, numeroMarcado: a.phoneNumber,
    personaContactada: a.spokeWith, cargo: a.spokeRole,
    resultado: codeLabel(r.code, "es"), fechaCompromiso: r.commitmentDate,
    obstaculo: r.obstacle ? label(OBSTACLES, r.obstacle, "es") : null,
    notas: [a.notes, r.notes].filter(Boolean).join(" | ") || null,
    campana: campaign, solicitudSigtur: c.sigturRequest, solicitadoPor: c.requestedBy,
  }));
  if (f.attemptId) return out;

  const vis = await db
    .select({ v: visits, e: { sigturId: establishments.sigturId, rut: establishments.rut, nombre: establishments.nombreComercial }, campaign: campaigns.name })
    .from(visits)
    .innerJoin(establishments, eq(establishments.id, visits.establishmentId))
    .innerJoin(campaigns, eq(campaigns.id, visits.campaignId))
    .where(and(...(f.from ? [gte(visits.visitDate, f.from)] : []), ...(f.to ? [lte(visits.visitDate, f.to)] : []), ...estW));
  for (const { v, e, campaign } of vis) {
    out.push({
      id: `visita-${v.id}`, idSigtur: e.sigturId, rut: e.rut, nombreComercial: e.nombre,
      fechaHora: `${v.visitDate}T16:00:00.000Z`, canal: "Visita", direccion: "Saliente",
      realizadoPor: people.get(v.userId) ?? null, numeroMarcado: null, personaContactada: null, cargo: null,
      resultado: codeLabel(v.code, "es"), fechaCompromiso: v.commitmentDate, obstaculo: null, notas: v.notes,
      campana: campaign, solicitudSigtur: false, solicitadoPor: null,
    });
  }

  const mails = await db
    .select({ id: establishments.id, sigturId: establishments.sigturId, rut: establishments.rut, nombre: establishments.nombreComercial, sent: establishments.correoEnviadoFecha, bounced: establishments.correoRebotado, campaign: campaigns.name })
    .from(establishments)
    .innerJoin(campaigns, eq(campaigns.id, establishments.campaignId))
    .where(and(sql`${establishments.correoEnviadoFecha} is not null`, ...(f.from ? [gte(establishments.correoEnviadoFecha, f.from)] : []), ...(f.to ? [lte(establishments.correoEnviadoFecha, f.to)] : []), ...estW));
  for (const m of mails) {
    out.push({
      id: `correo-${m.id}`, idSigtur: m.sigturId, rut: m.rut, nombreComercial: m.nombre,
      fechaHora: `${m.sent}T16:00:00.000Z`, canal: "Correo", direccion: "Saliente",
      realizadoPor: null, numeroMarcado: null, personaContactada: null, cargo: null,
      resultado: m.bounced === "Sí" ? "Correo rebotado" : "Correo enviado", fechaCompromiso: null, obstaculo: null, notas: null,
      campana: m.campaign, solicitudSigtur: false, solicitadoPor: null,
    });
  }
  out.sort((x, y) => x.fechaHora.localeCompare(y.fechaHora) || x.id.localeCompare(y.id));
  const start = f.offset ?? 0;
  return f.limit ? out.slice(start, start + f.limit) : out.slice(start);
}

// People ticked in «Solicitudes SIGTUR» to receive requests automatically.
export async function setAutoAssignees(ids: number[]) {
  const c = await requestsCampaign();
  const valid = ids.length ? (await db.select({ id: users.id }).from(users).where(and(inArray(users.id, ids), eq(users.active, true)))).map((u) => u.id) : [];
  await db.update(campaigns).set({ autoAssignees: JSON.stringify(valid) }).where(eq(campaigns.id, c.id));
}

export async function recentIntegrationLog(limit = 30) {
  return db.select().from(integrationLog).orderBy(sql`${integrationLog.id} desc`).limit(limit);
}

export async function listKeys() {
  return db.select().from(apiKeys).orderBy(asc(apiKeys.id));
}
