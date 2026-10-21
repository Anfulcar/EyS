import "server-only";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { callAttempts, callResults, companies, establishments, users, visits } from "@/db/schema";
import { addBusinessDays } from "./dates";

export type Breakdown = { key: string; universe: number; called: number; contacted: number; commitments: number; closed: number };

export type Stats = {
  universe: number;
  companies: number;
  expired: number;
  noLicense: number;
  called: number;
  contactedEffective: number;
  typified: number;
  operatingContacted: number;
  commitments: number;
  commitmentsDue: number;
  commitmentsKept: number;
  closed: number;
  needVisit: number;
  visitsDone: number;
  notified: number;
  emailsSent: number;
  emailsBounced: number;
  expiredOperating: number;
  expiredInProcess: number;
  noLicenseOperating: number;
  noLicenseApplied: number;
  attempts: number;
  byCode: { code: string; n: number }[];
  byDay: { day: string; calls: number; contacts: number }[];
  byAgent: { id: number; agent: string; companies: number; done: number; calls: number; contacts: number; commitments: number }[];
  byZone: Breakdown[];
  byPriority: Breakdown[];
  bySubsector: Breakdown[];
  byChannel: { key: string; n: number }[];
  byStatus: { key: string; n: number }[];
  companiesByStatus: { key: string; n: number }[];
};

const IN_PROCESS = ["En proceso", "Vigente"];
type Est = typeof establishments.$inferSelect;

// The rules behind every dashboard number (shared by the counts and by the lists behind them).
function predicates(visitsByEst: Map<number, string[]>) {
  const isClosed = (e: Est) => e.finalCode === "05" || (visitsByEst.get(e.id) ?? []).includes("V4") || e.estatusSigturActualizado === "Inactivo (depurado)";
  const isOperating = (e: Est) => e.enOperacion === "Sí";
  const isCommitment = (e: Est) => e.finalCode === "01" || !!e.fechaCompromiso;
  const inProcess = (e: Est) => !!e.estatusSigturActualizado && IN_PROCESS.includes(e.estatusSigturActualizado);
  const contactedAny = (e: Est) => !!e.finalCode && ["01", "02", "03", "04", "05", "06"].includes(e.finalCode);
  const today = new Date().toISOString().slice(0, 10);
  const limitOf = (e: Est) => addBusinessDays(e.fechaCompromiso!, 5);
  const commitmentDue = (e: Est) => !!e.fechaCompromiso && (limitOf(e) <= today || inProcess(e));
  const commitmentKept = (e: Est) => commitmentDue(e) && inProcess(e) && (!e.fechaCambioEstatus || e.fechaCambioEstatus <= limitOf(e));
  return { isClosed, isOperating, isCommitment, inProcess, contactedAny, commitmentDue, commitmentKept };
}

// Everything the dashboard numbers need, read in one go (one database round trip).
async function loadStatsData(campaignIds: number[]) {
  const ids = campaignIds.length ? campaignIds : [-1];
  const [ests, results, attempts, comps, vis, people] = await Promise.all([
    db.select().from(establishments).where(inArray(establishments.campaignId, ids)),
    db.select({ campaignId: callResults.campaignId, establishmentId: callResults.establishmentId, attemptId: callResults.attemptId, code: callResults.code }).from(callResults).where(inArray(callResults.campaignId, ids)),
    db
      .select({ campaignId: callAttempts.campaignId, id: callAttempts.id, userId: callAttempts.userId, calledAt: callAttempts.calledAt, contacted: callAttempts.contacted, attended: callAttempts.attended, isResponsible: callAttempts.isResponsible, companyId: callAttempts.companyId })
      .from(callAttempts)
      .where(inArray(callAttempts.campaignId, ids)),
    db.select({ campaignId: companies.campaignId, id: companies.id, status: companies.status, assignedUserId: companies.assignedUserId }).from(companies).where(inArray(companies.campaignId, ids)),
    db.select({ campaignId: visits.campaignId, establishmentId: visits.establishmentId, code: visits.code }).from(visits).where(inArray(visits.campaignId, ids)),
    db.select({ id: users.id, name: users.name }).from(users),
  ]);
  return { ests, results, attempts, comps, vis, people };
}
type StatsData = Awaited<ReturnType<typeof loadStatsData>>;

export async function computeStats(campaignIds: number[]): Promise<Stats> {
  return statsFrom(await loadStatsData(campaignIds));
}

// Totals for several campaigns plus each campaign on its own, from a single read.
export async function computeStatsByCampaign(campaignIds: number[], totalIds: number[]) {
  const data = await loadStatsData(campaignIds);
  const only = (ids: Set<number>): StatsData => ({
    ests: data.ests.filter((x) => ids.has(x.campaignId)),
    results: data.results.filter((x) => ids.has(x.campaignId)),
    attempts: data.attempts.filter((x) => ids.has(x.campaignId)),
    comps: data.comps.filter((x) => ids.has(x.campaignId)),
    vis: data.vis.filter((x) => ids.has(x.campaignId)),
    people: data.people,
  });
  return {
    all: statsFrom(only(new Set(totalIds))),
    per: new Map(campaignIds.map((id) => [id, statsFrom(only(new Set([id])))])),
  };
}

function statsFrom({ ests, results, attempts, comps, vis, people }: StatsData): Stats {
  const attemptById = new Map(attempts.map((a) => [a.id, a]));
  const calledSet = new Set<number>();
  const effective = new Set<number>();
  for (const r of results) {
    calledSet.add(r.establishmentId);
    const a = attemptById.get(r.attemptId);
    if (a?.contacted && a.attended !== false && a.isResponsible) effective.add(r.establishmentId);
  }
  const visitsByEst = new Map<number, string[]>();
  for (const v of vis) visitsByEst.set(v.establishmentId, [...(visitsByEst.get(v.establishmentId) ?? []), v.code]);

  const { isClosed, isOperating, isCommitment, inProcess, contactedAny, commitmentDue, commitmentKept } = predicates(visitsByEst);
  const commitmentsDue = ests.filter(commitmentDue).length;
  const commitmentsKept = ests.filter(commitmentKept).length;

  const breakdown = (keyFn: (e: (typeof ests)[0]) => string | null): Breakdown[] => {
    const m = new Map<string, Breakdown>();
    for (const e of ests) {
      const k = keyFn(e) || "—";
      const b = m.get(k) ?? { key: k, universe: 0, called: 0, contacted: 0, commitments: 0, closed: 0 };
      b.universe++;
      if (calledSet.has(e.id)) b.called++;
      if (contactedAny(e)) b.contacted++;
      if (isCommitment(e)) b.commitments++;
      if (isClosed(e)) b.closed++;
      m.set(k, b);
    }
    return [...m.values()].sort((a, b) => a.key.localeCompare(b.key));
  };
  const tally = (vals: (string | null)[]) => {
    const m = new Map<string, number>();
    for (const v of vals) if (v) m.set(v, (m.get(v) ?? 0) + 1);
    return [...m.entries()].map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n);
  };

  const codeCount = new Map<string, number>();
  for (const e of ests) if (e.finalCode) codeCount.set(e.finalCode, (codeCount.get(e.finalCode) ?? 0) + 1);

  const dayMap = new Map<string, { day: string; calls: number; contacts: number }>();
  for (const a of attempts) {
    const day = new Date(new Date(a.calledAt).getTime() - 4 * 3600000).toISOString().slice(0, 10);
    const d = dayMap.get(day) ?? { day, calls: 0, contacts: 0 };
    d.calls++;
    if (a.contacted && a.attended !== false) d.contacts++;
    dayMap.set(day, d);
  }

  const names = new Map(people.map((p) => [p.id, p.name]));
  const agentMap = new Map<number, Stats["byAgent"][number]>();
  const agentRow = (id: number) => {
    let r = agentMap.get(id);
    if (!r) {
      r = { id, agent: names.get(id) ?? `#${id}`, companies: 0, done: 0, calls: 0, contacts: 0, commitments: 0 };
      agentMap.set(id, r);
    }
    return r;
  };
  for (const c of comps) {
    if (!c.assignedUserId) continue;
    const r = agentRow(c.assignedUserId);
    r.companies++;
    if (c.status === "done" || c.status === "visit") r.done++;
  }
  for (const a of attempts) {
    const r = agentRow(a.userId);
    r.calls++;
    if (a.contacted && a.attended !== false) r.contacts++;
  }
  const commitmentAttempt = new Set(results.filter((r) => r.code === "01").map((r) => r.attemptId));
  for (const id of commitmentAttempt) {
    const a = attemptById.get(id);
    if (a) agentRow(a.userId).commitments++;
  }

  const expired = ests.filter((e) => e.estatusRnt === "Vencida");
  const noLic = ests.filter((e) => e.estatusRnt === "Sin licencia");
  const notified = ests.filter((e) => (e.correoEnviadoFecha && e.correoRebotado !== "Sí") || contactedAny(e) || visitsByEst.has(e.id)).length;

  return {
    universe: ests.length,
    companies: comps.length,
    expired: expired.length,
    noLicense: noLic.length,
    called: calledSet.size,
    contactedEffective: effective.size,
    typified: ests.filter((e) => e.finalCode).length,
    operatingContacted: ests.filter((e) => contactedAny(e) && isOperating(e)).length,
    commitments: ests.filter(isCommitment).length,
    commitmentsDue,
    commitmentsKept,
    closed: ests.filter(isClosed).length,
    needVisit: ests.filter((e) => e.requiereVisita === "Sí").length,
    visitsDone: vis.length,
    notified,
    emailsSent: ests.filter((e) => e.correoEnviadoFecha).length,
    emailsBounced: ests.filter((e) => e.correoRebotado === "Sí").length,
    expiredOperating: expired.filter((e) => !isClosed(e)).length,
    expiredInProcess: expired.filter(inProcess).length,
    noLicenseOperating: noLic.filter((e) => !isClosed(e)).length,
    noLicenseApplied: noLic.filter(inProcess).length,
    attempts: attempts.length,
    byCode: [...codeCount.entries()].map(([code, n]) => ({ code, n })).sort((a, b) => a.code.localeCompare(b.code)),
    byDay: [...dayMap.values()].sort((a, b) => a.day.localeCompare(b.day)),
    byAgent: [...agentMap.values()].sort((a, b) => b.calls - a.calls),
    byZone: breakdown((e) => e.zonaOperativa),
    byPriority: breakdown((e) => e.prioridad),
    bySubsector: breakdown((e) => e.subsector),
    byChannel: tally(ests.map((e) => e.canalLogro)),
    byStatus: tally(ests.map((e) => e.estatusSigturActualizado ?? e.estatusRnt)),
    companiesByStatus: tally(comps.map((c) => c.status)),
  };
}

// ---------- Lists behind the numbers ----------

export const METRICS = [
  "all", "called", "effective", "contacted", "typified", "operatingContacted", "commitments", "commitmentsDue", "commitmentsKept",
  "closed", "needVisit", "notified", "emailsSent", "bounced", "expiredOperating", "expiredInProcess", "noLicenseOperating", "noLicenseApplied",
] as const;
export type Metric = (typeof METRICS)[number];
export const DIMENSIONS = ["code", "status", "estatus", "channel", "zone", "priority", "subsector", "agent"] as const;
export type Dimension = (typeof DIMENSIONS)[number];
export type DrillFilter = { metric?: Metric; dim?: Dimension; value?: string };

export async function drillDown(campaignIds: number[], f: DrillFilter) {
  const ids = campaignIds.length ? campaignIds : [-1];
  const [ests, results, attempts, comps, vis, people] = await Promise.all([
    db.select().from(establishments).where(inArray(establishments.campaignId, ids)),
    db.select({ establishmentId: callResults.establishmentId, attemptId: callResults.attemptId }).from(callResults).where(inArray(callResults.campaignId, ids)),
    db.select({ id: callAttempts.id, contacted: callAttempts.contacted, attended: callAttempts.attended, isResponsible: callAttempts.isResponsible }).from(callAttempts).where(inArray(callAttempts.campaignId, ids)),
    db.select().from(companies).where(inArray(companies.campaignId, ids)),
    db.select({ establishmentId: visits.establishmentId, code: visits.code }).from(visits).where(inArray(visits.campaignId, ids)),
    db.select({ id: users.id, name: users.name }).from(users),
  ]);
  const attemptById = new Map(attempts.map((a) => [a.id, a]));
  const called = new Set<number>();
  const effective = new Set<number>();
  for (const r of results) {
    called.add(r.establishmentId);
    const a = attemptById.get(r.attemptId);
    if (a?.contacted && a.attended !== false && a.isResponsible) effective.add(r.establishmentId);
  }
  const visitsByEst = new Map<number, string[]>();
  for (const v of vis) visitsByEst.set(v.establishmentId, [...(visitsByEst.get(v.establishmentId) ?? []), v.code]);
  const p = predicates(visitsByEst);
  const compById = new Map(comps.map((c) => [c.id, c]));
  const names = new Map(people.map((u) => [u.id, u.name]));
  const notified = (e: Est) => (!!e.correoEnviadoFecha && e.correoRebotado !== "Sí") || p.contactedAny(e) || visitsByEst.has(e.id);
  const metricOk: Record<Metric, (e: Est) => boolean> = {
    all: () => true,
    called: (e) => called.has(e.id),
    effective: (e) => effective.has(e.id),
    contacted: p.contactedAny,
    typified: (e) => !!e.finalCode,
    operatingContacted: (e) => p.contactedAny(e) && p.isOperating(e),
    commitments: p.isCommitment,
    commitmentsDue: p.commitmentDue,
    commitmentsKept: p.commitmentKept,
    closed: p.isClosed,
    needVisit: (e) => e.requiereVisita === "Sí",
    notified,
    emailsSent: (e) => !!e.correoEnviadoFecha,
    bounced: (e) => e.correoRebotado === "Sí",
    expiredOperating: (e) => e.estatusRnt === "Vencida" && !p.isClosed(e),
    expiredInProcess: (e) => e.estatusRnt === "Vencida" && p.inProcess(e),
    noLicenseOperating: (e) => e.estatusRnt === "Sin licencia" && !p.isClosed(e),
    noLicenseApplied: (e) => e.estatusRnt === "Sin licencia" && p.inProcess(e),
  };
  const dimValue: Record<Dimension, (e: Est) => string | null> = {
    code: (e) => e.finalCode,
    status: (e) => compById.get(e.companyId)?.status ?? null,
    estatus: (e) => e.estatusSigturActualizado ?? e.estatusRnt,
    channel: (e) => e.canalLogro,
    zone: (e) => e.zonaOperativa || "—",
    priority: (e) => e.prioridad || "—",
    subsector: (e) => e.subsector || "—",
    agent: (e) => String(compById.get(e.companyId)?.assignedUserId ?? ""),
  };
  const metric = f.metric && metricOk[f.metric] ? metricOk[f.metric] : metricOk.all;
  const rows = ests.filter((e) => metric(e) && (!f.dim || !dimValue[f.dim] || dimValue[f.dim](e) === (f.value ?? "")));
  return rows
    .map((e) => {
      const c = compById.get(e.companyId);
      return { e, task: c ?? null, agent: c?.assignedUserId ? names.get(c.assignedUserId) ?? null : null };
    })
    .sort((a, b) => (a.e.prioridad ?? "").localeCompare(b.e.prioridad ?? "") || (a.e.nombreComercial ?? "").localeCompare(b.e.nombreComercial ?? ""));
}

export function parseDrill(sp: Record<string, string | undefined>): DrillFilter {
  return {
    metric: (METRICS as readonly string[]).includes(sp.m ?? "") ? (sp.m as Metric) : undefined,
    dim: (DIMENSIONS as readonly string[]).includes(sp.d ?? "") ? (sp.d as Dimension) : undefined,
    value: sp.v,
  };
}
