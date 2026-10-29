import { and, asc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { AlertTriangle, ArrowRightLeft, CalendarOff, CheckCircle2, Users2 } from "lucide-react";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Avatar } from "@/components/Avatar";
import { Overlay } from "@/components/Overlay";
import { ReceiversFields } from "@/components/ReceiversFields";
import { Empty, SectionTitle } from "@/components/ui";
import { db } from "@/db";
import { companies, users } from "@/db/schema";
import { CLOSED_STATUSES, ABSENCE_LABELS, label } from "@/lib/catalog";
import { fmtDate, nowIso, todayLocal } from "@/lib/dates";
import { getDict } from "@/lib/i18n-server";
import { dueCondition } from "@/lib/queue";
import { currentAndUpcomingAbsences, workload } from "@/lib/team";
import { coverTasksAction, moveTasksAction } from "../../../actions";

const IDLE_DAYS = 3;

export default async function FollowupPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { t, lang } = await getDict();
  const now = nowIso();
  const today = todayLocal();
  const idleSince = new Date(Date.now() - IDLE_DAYS * 86400000).toISOString();
  const n = (cond: ReturnType<typeof sql>) => sql<number>`sum(case when ${cond} then 1 else 0 end)`;
  const [counts, staff, absences] = await Promise.all([
    db
      .select({
        userId: companies.assignedUserId,
        total: sql<number>`count(*)`,
        open: n(sql`${companies.status} not in ('done', 'transferred')`),
        due: n(sql`${dueCondition(now)}`),
        overdue: n(sql`${companies.status} = 'followup' and ${companies.nextActionAt} < ${now}`),
        idle: n(sql`${companies.status} not in ('done', 'transferred') and coalesce(${companies.lastCalledAt}, ${companies.assignedAt}, '') < ${idleSince}`),
        covering: n(sql`${companies.coverAbsenceId} is not null and ${companies.assignedUserId} = ${companies.coverUserId}`),
        scheduled: n(sql`${companies.coverAbsenceId} is not null and ${companies.assignedUserId} = ${companies.coverFromUserId}`),
        sigturOverdue: n(sql`${companies.sigturRequest} = 1 and ${companies.requestResolvedAt} is null and ${companies.requestOverdueAt} is not null`),
      })
      .from(companies)
      .where(eq(companies.campaignId, id))
      .groupBy(companies.assignedUserId),
    db.select().from(users).where(and(eq(users.active, true), inArray(users.role, ["agent", "supervisor", "admin"]))).orderBy(asc(users.name)),
    currentAndUpcomingAbsences(14),
  ]);
  const [load, pending, coveredRows] = await Promise.all([
    workload(staff.map((s) => s.id)),
    // Open tasks in this campaign of people with an absence, not yet covered.
    absences.length
      ? db
          .select({ userId: companies.assignedUserId, n: sql<number>`count(*)` })
          .from(companies)
          .where(and(eq(companies.campaignId, id), notInArray(companies.status, CLOSED_STATUSES), inArray(companies.assignedUserId, absences.map((a) => a.userId)), sql`${companies.coverAbsenceId} is null`))
          .groupBy(companies.assignedUserId)
      : [],
    db.select({ absenceId: companies.coverAbsenceId, n: sql<number>`count(*)` }).from(companies).where(and(eq(companies.campaignId, id), sql`${companies.coverAbsenceId} is not null`)).groupBy(companies.coverAbsenceId),
  ]);
  const coveredBy = new Map(coveredRows.map((r) => [r.absenceId, Number(r.n)]));
  const byUser = new Map(counts.map((c) => [c.userId, c]));
  const names = new Map(staff.map((s) => [s.id, s.name]));
  const absentNow = new Map(absences.filter((a) => a.fromDate <= today).map((a) => [a.userId, a]));
  const nextAbsence = new Map<number, (typeof absences)[number]>();
  for (const a of absences) if (!nextAbsence.has(a.userId)) nextAbsence.set(a.userId, a);
  const pendingBy = new Map(pending.map((p) => [p.userId, Number(p.n)]));
  const people = staff.map((s) => ({ id: s.id, name: s.name, load: load.get(s.id) ?? 0, absent: absentNow.has(s.id), agent: s.role === "agent" }));
  // People shown: agents, plus anyone with tasks in this campaign.
  const rows = staff.filter((s) => s.role === "agent" || byUser.has(s.id));
  const unassigned = byUser.get(null);
  const list = (o: Record<string, string | number>) => `/campaigns/${id}/companies?` + new URLSearchParams(Object.entries(o).map(([k, v]) => [k, String(v)])).toString();
  // Absences with open tasks to cover, or already covered (kept on screen so the result can be seen).
  const warnings = absences.filter((a) => (pendingBy.get(a.userId) ?? 0) > 0 || (coveredBy.get(a.id) ?? 0) > 0);
  const Num = ({ v, href, tone }: { v: number; href: string; tone?: string }) =>
    v ? <Link href={href} className={`font-semibold hover:underline ${tone ?? "text-slate-900"}`}>{v}</Link> : <span className="text-slate-300">0</span>;

  return (
    <div className="space-y-6">
      {warnings.map((a) => (
        <div key={a.id} className={`card space-y-3 ring-2 ${(pendingBy.get(a.userId) ?? 0) > 0 ? "ring-mitur-orange/60" : "ring-emerald-200"}`}>
          <div className="flex flex-wrap items-center gap-3">
            {(pendingBy.get(a.userId) ?? 0) > 0 ? <AlertTriangle className="h-5 w-5 text-mitur-orange" /> : <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
            <p className="flex-1 text-sm text-slate-800">
              {((pendingBy.get(a.userId) ?? 0) > 0 ? t.absenceWarning : t.absenceCovered)
                .replace("{name}", names.get(a.userId) ?? "—")
                .replace("{kind}", label(ABSENCE_LABELS, a.kind, lang))
                .replace("{from}", fmtDate(a.fromDate, lang))
                .replace("{to}", fmtDate(a.toDate, lang))
                .replace("{n}", String(pendingBy.get(a.userId) ?? 0))
                .replace("{c}", String(coveredBy.get(a.id) ?? 0))}
            </p>
            <Overlay variant="drawer" trigger={<><Users2 className="h-4 w-4" />{t.coverDuringAbsence}</>} title={`${t.coverDuringAbsence}: ${names.get(a.userId) ?? ""}`}>
              <ActionForm action={coverTasksAction} className="space-y-5">
                <input type="hidden" name="campaignId" value={id} />
                <input type="hidden" name="absenceId" value={a.id} />
                <p className="text-sm text-slate-600">{t.coverHelp.replace("{to}", fmtDate(a.toDate, lang))}</p>
                <ReceiversFields people={people} t={t} exclude={a.userId} />
                <div className="flex justify-end"><SubmitButton>{t.coverDuringAbsence}</SubmitButton></div>
              </ActionForm>
            </Overlay>
          </div>
        </div>
      ))}

      <div className="card overflow-hidden p-0">
        <div className="px-5 pt-5"><SectionTitle icon={<Users2 className="h-4 w-4" />}>{t.followupTitle}</SectionTitle></div>
        {rows.length === 0 ? (
          <div className="p-5"><Empty>{t.noData}</Empty></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t.agent}</th>
                  <th className="text-right">{t.fuAssigned}</th>
                  <th className="text-right">{t.fOpen}</th>
                  <th className="text-right">{t.dueNow}</th>
                  <th className="text-right">{t.fOverdue}</th>
                  <th className="text-right">{t.fuIdle.replace("{n}", String(IDLE_DAYS))}</th>
                  <th className="text-right">{t.fSigturOverdue}</th>
                  <th>{t.fuAvailability}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const c = byUser.get(s.id);
                  const abs = nextAbsence.get(s.id);
                  return (
                    <tr key={s.id}>
                      <td className="min-w-[12rem]">
                        <div className="flex items-center gap-3">
                          <Avatar name={s.name} size="sm" />
                          <div>
                            <Link href={`/agents/${s.id}?campaign=${id}`} className="font-medium text-brand-700 hover:underline" title={t.openAgentSummary.replace("{name}", s.name)}>{s.name}</Link>
                            <div className="text-xs text-slate-500">{t.openLoad.replace("{n}", String(load.get(s.id) ?? 0))}</div>
                          </div>
                        </div>
                      </td>
                      <td className="text-right"><Num v={Number(c?.total ?? 0)} href={list({ agent: s.id })} /></td>
                      <td className="text-right"><Num v={Number(c?.open ?? 0)} href={list({ agent: s.id, f: "open" })} /></td>
                      <td className="text-right"><Num v={Number(c?.due ?? 0)} href={list({ agent: s.id, f: "due" })} /></td>
                      <td className="text-right"><Num v={Number(c?.overdue ?? 0)} href={list({ agent: s.id, f: "overdue" })} tone="text-mitur-red" /></td>
                      <td className="text-right"><Num v={Number(c?.idle ?? 0)} href={list({ agent: s.id, f: "idle", days: IDLE_DAYS })} tone="text-amber-700" /></td>
                      <td className="text-right"><Num v={Number(c?.sigturOverdue ?? 0)} href={list({ agent: s.id, f: "sigturOverdue" })} tone="text-mitur-red" /></td>
                      <td className="whitespace-nowrap text-xs">
                        {abs ? (
                          <span className={`badge ${abs.fromDate <= today ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
                            <CalendarOff className="h-3.5 w-3.5" />
                            {abs.fromDate <= today ? t.absentTag : label(ABSENCE_LABELS, abs.kind, lang)} · {fmtDate(abs.fromDate, lang)} – {fmtDate(abs.toDate, lang)}
                          </span>
                        ) : (
                          <span className="text-emerald-700">{t.available}</span>
                        )}
                        {Number(c?.covering ?? 0) > 0 && <div className="mt-1 text-amber-700">{t.coveringCount.replace("{n}", String(c?.covering))}</div>}
                        {Number(c?.scheduled ?? 0) > 0 && <div className="mt-1 text-slate-500">{t.coverScheduled.replace("{n}", String(c?.scheduled))}</div>}
                      </td>
                      <td className="text-right">
                        {Number(c?.open ?? 0) > 0 && (
                          <Overlay variant="drawer" triggerClassName="btn-secondary btn-sm whitespace-nowrap" trigger={<><ArrowRightLeft className="h-3.5 w-3.5" />{t.moveOpenTasks}</>} title={`${t.moveOpenTasks}: ${s.name}`}>
                            <ActionForm action={moveTasksAction} className="space-y-5">
                              <input type="hidden" name="campaignId" value={id} />
                              <input type="hidden" name="fromUserId" value={s.id} />
                              <p className="text-sm text-slate-600">{t.moveHelp.replace("{n}", String(c?.open ?? 0))}</p>
                              <ReceiversFields people={people} t={t} exclude={s.id} />
                              <div className="flex justify-end"><SubmitButton>{t.moveOpenTasks}</SubmitButton></div>
                            </ActionForm>
                          </Overlay>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {unassigned && (
                  <tr>
                    <td className="font-medium text-slate-500">{t.unassigned}</td>
                    <td className="text-right"><Num v={Number(unassigned.total)} href={list({ agent: "none" })} /></td>
                    <td className="text-right"><Num v={Number(unassigned.open)} href={list({ agent: "none", f: "open" })} /></td>
                    <td colSpan={6} />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
