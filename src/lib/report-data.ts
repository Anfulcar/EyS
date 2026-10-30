import "server-only";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { callAttempts, callResults, campaigns, companies, establishments, statusChanges, users, visits } from "@/db/schema";
import { CALL_CODES, CHANNELS, codeLabel, COMPANY_STATUSES, label, OPERATION_LABELS, ROLES, SIGTUR_STATUSES, VISIT_CODES, type Lang } from "./catalog";
import { fmtDate, fmtDateTime, localDayEnd, localDayStart, nowIso, todayLocal } from "./dates";
import { CALL_HELP, CHANNEL_HELP, PRIORITY_HELP, SIGTUR_HELP, STATUS_HELP, VISIT_HELP } from "./legend";
import { DETAIL_LABELS, PERIOD_LABELS, resolvePeriod, type ReportOptions } from "./report-options";
import { computeStatsByCampaign, drillDown, type Stats } from "./stats";

export type Goal = { title: string; n: number; d: number; target: number; delta: number | null };
export type Row = (string | number)[];
export type ReportData = {
  lang: Lang;
  title: string;
  comments: string;
  campaignNames: string[];
  // Agent report: "Name · Role" (empty for the whole team)
  agentText: string;
  periodText: string;
  periodShort: string;
  generatedText: string;
  goals: Goal[];
  counts: [string, number][];
  campaignTable: { head: string[]; rows: Row[] };
  codes: { label: string; n: number; tone: "good" | "info" | "warn" | "bad" | "none" }[];
  codesTitle: string;
  agents: { head: string[]; rows: Row[] };
  zones: { head: string[]; rows: Row[] };
  priorities: { head: string[]; rows: Row[] };
  subsectors: { head: string[]; rows: Row[] };
  sigtur: [string, number][];
  channels: [string, number][];
  operation: [string, number][];
  daily: { label: string; calls: number; contacts: number }[];
  dailyTitle: string;
  legend: { title: string; items: [string, string][] }[];
  detail: { title: string; head: string[]; rows: Row[] };
};

const IN_PROCESS = ["En proceso", "Vigente"];
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)} %` : "—");
const TONE: Record<string, "good" | "info" | "warn" | "bad" | "none"> = {
  "01": "good", "02": "good", "03": "info", "04": "bad", "05": "bad", "06": "info", "07": "none", "08": "none", "09": "none", "10": "none",
};

const T = {
  es: {
    period: "Período", campaigns: "Campañas", generated: "Generado", everything: "Todo lo acumulado",
    scheduled: "programado", by: "por", goalCalled: "Llamados al menos 1 vez", goalContact: "Contacto efectivo",
    goalCommit: "Compromisos", goalAdvance: "Vencidas que pasan a En proceso", universe: "Universo", callsPeriod: "Llamadas en el período",
    calls: "Llamadas", closed: "Cerrados (depuración)", closedShort: "Cerrados", needVisit: "Requieren visita", emails: "Correos enviados", bounced: "Rebotados",
    visitsPeriod: "Visitas en el período", campaign: "Campaña", called: "Llamados", effective: "Contacto ef.", commitments: "Compromisos",
    inProcess: "En proceso", total: "Total", codesPeriod: "Resultados por tipificación (período)", codesAll: "Resultados por tipificación (resultado actual)",
    agent: "Agente", assigned: "Tareas asignadas", contacts: "Contactos", done: "Terminadas", zone: "Zona", priority: "Prioridad",
    subsector: "Subsector", dailyTitle: "Llamadas por día", weeklyTitle: "Llamadas por semana", weekOf: "Sem.", lPriorities: "Prioridades",
    lStatus: "Estado de la tarea", lCalls: "Resultados de llamada", lVisits: "Resultados de visita", lSigtur: "Estatus SIGTUR",
    lChannels: "Canal que logró la gestión", establishment: "Establecimiento", status: "Estado", lastResult: "Último resultado", detail: "Detalle de establecimientos",
  },
  en: {
    period: "Period", campaigns: "Campaigns", generated: "Generated", everything: "Everything to date",
    scheduled: "scheduled", by: "by", goalCalled: "Called at least once", goalContact: "Effective contact",
    goalCommit: "Commitments", goalAdvance: "Expired moving to In process", universe: "Universe", callsPeriod: "Calls in the period",
    calls: "Calls", closed: "Closed (clean-up)", closedShort: "Closed", needVisit: "Need a visit", emails: "Emails sent", bounced: "Bounced",
    visitsPeriod: "Visits in the period", campaign: "Campaign", called: "Called", effective: "Eff. contact", commitments: "Commitments",
    inProcess: "In process", total: "Total", codesPeriod: "Results by outcome (period)", codesAll: "Results by outcome (current result)",
    agent: "Agent", assigned: "Tasks assigned", contacts: "Contacts", done: "Finished", zone: "Zone", priority: "Priority",
    subsector: "Subsector", dailyTitle: "Calls per day", weeklyTitle: "Calls per week", weekOf: "Wk", lPriorities: "Priorities",
    lStatus: "Task status", lCalls: "Call results", lVisits: "Visit results", lSigtur: "SIGTUR status",
    lChannels: "Channel that achieved it", establishment: "Establishment", status: "Status", lastResult: "Last result", detail: "Establishment detail",
  },
};

export async function campaignIdsFor(o: ReportOptions) {
  if (o.campaigns === "pick") return o.campaignIds;
  const rows = await db.select({ id: campaigns.id }).from(campaigns).where(and(ne(campaigns.kind, "email"), o.campaigns === "active" ? ne(campaigns.status, "closed") : undefined));
  return rows.map((r) => r.id);
}

export type ReportAgent = { id: number; name: string; role: string };

// With an agent: their portfolio (tasks assigned to them now) and the calls they made.
export async function buildReport(o: ReportOptions, who: { name: string; scheduled?: boolean }, lang: Lang = "es", today = todayLocal(), agent?: ReportAgent): Promise<ReportData> {
  const t = T[lang];
  const ids = await campaignIdsFor(o);
  const list = ids.length ? await db.select().from(campaigns).where(inArray(campaigns.id, ids)).orderBy(desc(campaigns.startDate)) : [];
  const realIds = list.map((c) => c.id);
  const range = resolvePeriod(o, today);
  const hasPeriod = !!(range.from || range.to);
  const fromIso = range.from ? localDayStart(range.from) : "";
  const toIso = range.to ? localDayEnd(range.to) : "9999";
  const inIso = (v: string | null | undefined) => !!v && v >= fromIso && v <= toIso;
  const inDay = (v: string | null | undefined) => !!v && (!range.from || v.slice(0, 10) >= range.from) && (!range.to || v.slice(0, 10) <= range.to);

  const ids2 = realIds.length ? realIds : [-1];
  const [{ all: s, per }, attempts, allResults, allVis, allChanges, ests, people] = await Promise.all([
    computeStatsByCampaign(realIds, realIds, agent?.id),
    db
      .select({ id: callAttempts.id, userId: callAttempts.userId, calledAt: callAttempts.calledAt, contacted: callAttempts.contacted, attended: callAttempts.attended, isResponsible: callAttempts.isResponsible })
      .from(callAttempts)
      .where(and(inArray(callAttempts.campaignId, ids2), agent ? eq(callAttempts.userId, agent.id) : undefined)),
    db.select({ attemptId: callResults.attemptId, establishmentId: callResults.establishmentId, code: callResults.code }).from(callResults).where(inArray(callResults.campaignId, ids2)),
    db.select({ establishmentId: visits.establishmentId, visitDate: visits.visitDate }).from(visits).where(inArray(visits.campaignId, ids2)),
    db.select({ establishmentId: statusChanges.establishmentId, newStatus: statusChanges.newStatus, changedAt: statusChanges.changedAt }).from(statusChanges).where(inArray(statusChanges.campaignId, ids2)),
    db
      .select({ id: establishments.id, estatusRnt: establishments.estatusRnt })
      .from(establishments)
      .innerJoin(companies, eq(companies.id, establishments.companyId))
      .where(and(inArray(establishments.campaignId, ids2), agent ? eq(companies.assignedUserId, agent.id) : undefined)),
    db.select({ id: users.id, name: users.name }).from(users),
  ]);
  // Agent report: only the results of their own calls, and visits / status changes on their portfolio.
  const ownAttempts = new Set(attempts.map((a) => a.id));
  const portfolio = new Set(ests.map((e) => e.id));
  const results = agent ? allResults.filter((r) => ownAttempts.has(r.attemptId)) : allResults;
  const vis = agent ? allVis.filter((v) => portfolio.has(v.establishmentId)) : allVis;
  const changes = agent ? allChanges.filter((c) => portfolio.has(c.establishmentId)) : allChanges;
  const names = new Map(people.map((p) => [p.id, p.name]));
  const attemptById = new Map(attempts.map((a) => [a.id, a]));
  const periodAttempts = hasPeriod ? attempts.filter((a) => inIso(a.calledAt)) : attempts;
  const periodAttemptIds = new Set(periodAttempts.map((a) => a.id));
  const periodResults = results.filter((r) => periodAttemptIds.has(r.attemptId));
  const isContact = (a: { contacted: boolean; attended: boolean | null }) => a.contacted && a.attended !== false;

  // "+N in the period" for each goal: establishments that reached it during the period.
  let deltas: (number | null)[] = [null, null, null, null];
  if (hasPeriod) {
    const firstCall = new Map<number, string>();
    const firstEffective = new Map<number, string>();
    for (const r of results) {
      const a = attemptById.get(r.attemptId);
      if (!a) continue;
      if (!firstCall.has(r.establishmentId) || a.calledAt < firstCall.get(r.establishmentId)!) firstCall.set(r.establishmentId, a.calledAt);
      if (isContact(a) && a.isResponsible && (!firstEffective.has(r.establishmentId) || a.calledAt < firstEffective.get(r.establishmentId)!)) firstEffective.set(r.establishmentId, a.calledAt);
    }
    const expired = new Set(ests.filter((e) => e.estatusRnt === "Vencida").map((e) => e.id));
    deltas = [
      [...firstCall.values()].filter(inIso).length,
      [...firstEffective.values()].filter(inIso).length,
      new Set(periodResults.filter((r) => r.code === "01").map((r) => r.establishmentId)).size,
      new Set(changes.filter((c) => expired.has(c.establishmentId) && IN_PROCESS.includes(c.newStatus) && inDay(c.changedAt)).map((c) => c.establishmentId)).size,
    ];
  }

  const goals: Goal[] = [
    { title: t.goalCalled, n: s.called, d: s.universe, target: 100, delta: deltas[0] },
    { title: t.goalContact, n: s.contactedEffective, d: s.called, target: 65, delta: deltas[1] },
    { title: t.goalCommit, n: s.commitments, d: s.operatingContacted, target: 70, delta: deltas[2] },
    { title: t.goalAdvance, n: s.expiredInProcess, d: s.expiredOperating, target: 80, delta: deltas[3] },
  ];
  const counts: [string, number][] = [
    [t.universe, s.universe],
    [hasPeriod ? t.callsPeriod : t.calls, periodAttempts.length],
    [t.closed, s.closed],
    [t.needVisit, s.needVisit],
    [hasPeriod ? t.visitsPeriod : t.emails, hasPeriod ? vis.filter((v) => inDay(v.visitDate)).length : s.emailsSent],
    [t.bounced, s.emailsBounced],
  ];

  const campRow = (name: string, x: Stats): Row => [name, x.universe, pct(x.called, x.universe), pct(x.contactedEffective, x.called), x.commitments, x.expiredInProcess + x.noLicenseApplied];
  const campaignTable = {
    head: [t.campaign, t.universe, t.called, t.effective, t.commitments, t.inProcess],
    // An agent's report only lists the campaigns where they have tasks.
    rows: (() => {
      const shown = agent ? list.filter((c) => per.get(c.id)!.universe > 0) : list;
      return [...shown.map((c) => campRow(c.name, per.get(c.id)!)), ...(shown.length > 1 ? [campRow(t.total, s)] : [])];
    })(),
  };

  const codeCount = new Map<string, number>();
  if (hasPeriod) for (const r of periodResults) codeCount.set(r.code, (codeCount.get(r.code) ?? 0) + 1);
  else for (const c of s.byCode) codeCount.set(c.code, c.n);
  const codes = [...codeCount.entries()]
    .filter(([code]) => CALL_CODES[code] || VISIT_CODES[code])
    .sort((a, b) => b[1] - a[1])
    .map(([code, n]) => ({ label: codeLabel(code, lang), n, tone: TONE[code] ?? "info" }));

  // Agents: tasks from the current state, calls/contacts/commitments from the period.
  const agentRows = new Map<number, { calls: number; contacts: number; commitments: Set<number> }>();
  for (const a of periodAttempts) {
    const r = agentRows.get(a.userId) ?? { calls: 0, contacts: 0, commitments: new Set<number>() };
    r.calls++;
    if (isContact(a)) r.contacts++;
    agentRows.set(a.userId, r);
  }
  for (const r of periodResults) if (r.code === "01") {
    const a = attemptById.get(r.attemptId);
    if (a) agentRows.get(a.userId)?.commitments.add(r.establishmentId);
  }
  const agentIds = agent ? [agent.id] : [...new Set([...s.byAgent.map((a) => a.id), ...agentRows.keys()])];
  const agents = {
    head: [t.agent, t.assigned, t.calls, t.contacts, t.commitments, t.done],
    rows: agentIds
      .map((id) => {
        const base = s.byAgent.find((a) => a.id === id);
        const p = agentRows.get(id);
        return [names.get(id) ?? `#${id}`, base?.companies ?? 0, p?.calls ?? 0, p?.contacts ?? 0, p?.commitments.size ?? 0, base?.done ?? 0] as Row;
      })
      .sort((a, b) => Number(b[2]) - Number(a[2])),
  };
  const bd = (rows: Stats["byZone"], head: string) => ({
    head: [head, t.universe, t.called, t.contacts, t.commitments, t.closedShort],
    rows: rows.map((b) => [b.key, b.universe, b.called, b.contacted, b.commitments, b.closed] as Row),
  });

  // Calls per day (per week when the span is longer than a month).
  const dayMap = new Map<string, { calls: number; contacts: number }>();
  for (const a of periodAttempts) {
    const day = new Date(new Date(a.calledAt).getTime() - 4 * 3600000).toISOString().slice(0, 10);
    const d = dayMap.get(day) ?? { calls: 0, contacts: 0 };
    d.calls++;
    if (isContact(a)) d.contacts++;
    dayMap.set(day, d);
  }
  if (range.from && range.to && range.to <= today) {
    for (let d = range.from; d <= range.to; d = new Date(new Date(`${d}T12:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10)) if (!dayMap.has(d)) dayMap.set(d, { calls: 0, contacts: 0 });
  }
  let daily = [...dayMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([d, v]) => ({ label: fmtDate(d, lang).replace(/ de \d{4}$|, \d{4}$/, "").replace(/\s\d{4}$/, ""), day: d, ...v }));
  let dailyTitle = t.dailyTitle;
  if (daily.length > 31) {
    const weeks = new Map<string, { label: string; calls: number; contacts: number }>();
    for (const d of daily) {
      const dt = new Date(`${d.day}T12:00:00Z`);
      const monday = new Date(dt.getTime() - ((dt.getUTCDay() + 6) % 7) * 86400000).toISOString().slice(0, 10);
      const w = weeks.get(monday) ?? { label: `${t.weekOf} ${fmtDate(monday, lang).replace(/ de \d{4}$|, \d{4}$/, "").replace(/\s\d{4}$/, "")}`, calls: 0, contacts: 0 };
      w.calls += d.calls;
      w.contacts += d.contacts;
      weeks.set(monday, w);
    }
    daily = [...weeks.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([day, w]) => ({ day, ...w }));
    dailyTitle = t.weeklyTitle;
  }

  const legend = [
    { title: t.lPriorities, items: Object.entries(PRIORITY_HELP).map(([k, v]) => [k, v[lang]] as [string, string]) },
    { title: t.lStatus, items: Object.entries(COMPANY_STATUSES).map(([k, v]) => [v[lang], STATUS_HELP[k]?.[lang] ?? ""] as [string, string]) },
    { title: t.lCalls, items: Object.entries(CALL_CODES).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [v[lang], (CALL_HELP[k]?.[lang] ?? "").replace("{days}", "5")] as [string, string]) },
    { title: t.lVisits, items: Object.entries(VISIT_CODES).map(([k, v]) => [v[lang], VISIT_HELP[k]?.[lang] ?? ""] as [string, string]) },
    { title: t.lSigtur, items: SIGTUR_STATUSES.map((x) => [x, SIGTUR_HELP[x]?.[lang] ?? ""] as [string, string]) },
    { title: t.lChannels, items: CHANNELS.map((x) => [x, CHANNEL_HELP[x]?.[lang] ?? ""] as [string, string]) },
  ];

  let detail = { title: t.detail, head: [] as string[], rows: [] as Row[] };
  if (o.sections.includes("detail")) {
    const rows = await drillDown(realIds, agent ? { metric: o.detail, dim: "agent", value: String(agent.id) } : { metric: o.detail });
    detail = {
      title: `${t.detail} · ${DETAIL_LABELS[o.detail][lang].replace(/^Solo (los )?(que )?/i, "").replace(/^Only (those )?/i, "")} (${rows.length})`,
      head: [t.establishment, t.zone, t.priority, t.status, t.lastResult],
      rows: rows.map(({ e, task }) => [e.nombreComercial ?? e.sigturId, (e.zonaOperativa ?? "—").split(".")[0], e.prioridad ?? "—", task ? label(COMPANY_STATUSES, task.status, lang) : "—", e.finalCode ? codeLabel(e.finalCode, lang) : "—"]),
    };
  }

  const periodText = hasPeriod
    ? `${PERIOD_LABELS[o.period][lang]}: ${range.from ? fmtDate(range.from, lang) : "…"} – ${range.to ? fmtDate(range.to, lang) : "…"}`
    : t.everything;
  return {
    lang,
    title: agent ? `${o.title} – ${agent.name}` : o.title,
    agentText: agent ? `${agent.name} · ${label(ROLES, agent.role, lang)}` : "",
    comments: o.comments,
    campaignNames: list.map((c) => c.name),
    periodText,
    periodShort: hasPeriod ? `${range.from ? fmtDate(range.from, lang) : "…"} – ${range.to ? fmtDate(range.to, lang) : "…"}` : t.everything,
    generatedText: `${fmtDateTime(nowIso(), lang)} · ${who.scheduled ? `${t.scheduled} ${t.by}` : t.by} ${who.name}`,
    goals,
    counts,
    campaignTable,
    codes,
    codesTitle: hasPeriod ? t.codesPeriod : t.codesAll,
    agents,
    zones: bd(s.byZone, t.zone),
    priorities: bd(s.byPriority, t.priority),
    subsectors: bd(s.bySubsector, t.subsector),
    sigtur: s.byStatus.map((x) => [x.key, x.n]),
    channels: s.byChannel.map((x) => [x.key, x.n]),
    operation: s.byOperation.map((x) => [OPERATION_LABELS[x.key][lang], x.n]),
    daily,
    dailyTitle,
    legend,
    detail,
  };
}
