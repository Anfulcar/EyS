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
  byAgent: { agent: string; companies: number; done: number; calls: number; contacts: number; commitments: number }[];
  byZone: Breakdown[];
  byPriority: Breakdown[];
  bySubsector: Breakdown[];
  byChannel: { key: string; n: number }[];
  byStatus: { key: string; n: number }[];
  companiesByStatus: { key: string; n: number }[];
};

const IN_PROCESS = ["En proceso", "Vigente"];

export async function computeStats(campaignIds: number[]): Promise<Stats> {
  const ids = campaignIds.length ? campaignIds : [-1];
  const [ests, results, attempts, comps, vis, people] = await Promise.all([
    db.select().from(establishments).where(inArray(establishments.campaignId, ids)),
    db.select({ establishmentId: callResults.establishmentId, attemptId: callResults.attemptId, code: callResults.code }).from(callResults).where(inArray(callResults.campaignId, ids)),
    db
      .select({ id: callAttempts.id, userId: callAttempts.userId, calledAt: callAttempts.calledAt, contacted: callAttempts.contacted, attended: callAttempts.attended, isResponsible: callAttempts.isResponsible, companyId: callAttempts.companyId })
      .from(callAttempts)
      .where(inArray(callAttempts.campaignId, ids)),
    db.select({ id: companies.id, status: companies.status, assignedUserId: companies.assignedUserId }).from(companies).where(inArray(companies.campaignId, ids)),
    db.select({ establishmentId: visits.establishmentId, code: visits.code }).from(visits).where(inArray(visits.campaignId, ids)),
    db.select({ id: users.id, name: users.name }).from(users),
  ]);
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

  const isClosed = (e: (typeof ests)[0]) => e.finalCode === "05" || (visitsByEst.get(e.id) ?? []).includes("V4") || e.estatusSigturActualizado === "Inactivo (depurado)";
  const isOperating = (e: (typeof ests)[0]) => e.enOperacion === "Sí";
  const isCommitment = (e: (typeof ests)[0]) => e.finalCode === "01" || !!e.fechaCompromiso;
  const inProcess = (e: (typeof ests)[0]) => !!e.estatusSigturActualizado && IN_PROCESS.includes(e.estatusSigturActualizado);
  const contactedAny = (e: (typeof ests)[0]) => !!e.finalCode && ["01", "02", "03", "04", "05", "06"].includes(e.finalCode);

  const today = new Date().toISOString().slice(0, 10);
  let commitmentsDue = 0;
  let commitmentsKept = 0;
  for (const e of ests) {
    if (!e.fechaCompromiso) continue;
    const limit = addBusinessDays(e.fechaCompromiso, 5);
    if (limit > today && !inProcess(e)) continue; // not due yet
    commitmentsDue++;
    if (inProcess(e) && (!e.fechaCambioEstatus || e.fechaCambioEstatus <= limit)) commitmentsKept++;
  }

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
  const agentMap = new Map<number, { agent: string; companies: number; done: number; calls: number; contacts: number; commitments: number }>();
  const agentRow = (id: number) => {
    let r = agentMap.get(id);
    if (!r) {
      r = { agent: names.get(id) ?? `#${id}`, companies: 0, done: 0, calls: 0, contacts: 0, commitments: 0 };
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
