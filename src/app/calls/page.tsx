import { and, asc, eq, gt, gte, inArray, ne, sql, type SQL } from "drizzle-orm";
import { AlertTriangle, BarChart3, BellRing, Building2, ChevronRight, Clock, MessageCircle, Phone, Sparkles } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { RefreshButton } from "@/components/RefreshButton";
import { Empty, PriorityBadge, SigturTag, StatusBadge } from "@/components/ui";
import { db } from "@/db";
import { campaigns, companies, establishments, phones, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { CLOSED_STATUSES, codeLabel, COMPANY_STATUSES, label } from "@/lib/catalog";
import { fmtDateTime, nowIso, todayLocal } from "@/lib/dates";
import { getDict } from "@/lib/i18n-server";
import { requestDeadline } from "@/lib/sigtur";
import { attentionSummary, daysSince, dueCondition } from "@/lib/queue";

const TABS = ["due", "scheduled", "visit", "done"] as const;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const PAGE = 100;
const rncKey = sql<string>`replace(replace(replace(coalesce(${companies.rnc}, ''), '-', ''), ' ', ''), '.', '')`;

export default async function CallsPage({ searchParams }: { searchParams: Promise<{ tab?: string; agent?: string; campaign?: string; limit?: string; att?: string }> }) {
  // The open campaigns are read at the same time as the account (nothing is shown before the role check).
  const [me, sp, { t, lang }, open] = await Promise.all([
    requireUser(["agent", "admin", "supervisor"]),
    searchParams,
    getDict(),
    db.select().from(campaigns).where(ne(campaigns.status, "closed")),
  ]);
  const tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? sp.tab! : "due";
  const isManager = me.role !== "agent";
  const agentId = isManager && sp.agent ? Number(sp.agent) : me.id;
  const limit = Math.min(2000, Math.max(PAGE, Number(sp.limit) || PAGE));
  const today = todayLocal();
  const now = nowIso();

  // Every campaign that is not closed: draft or out-of-dates campaigns are shown with a warning instead of hidden.
  const warnings = open.filter((c) => c.status !== "active" || today < c.startDate || today > c.endDate);
  const campaignIds = open.map((c) => c.id).filter((id) => !sp.campaign || id === Number(sp.campaign));

  const base: SQL[] = [
    inArray(companies.campaignId, campaignIds.length ? campaignIds : [-1]),
    eq(companies.assignedUserId, agentId),
    sql`exists (select 1 from establishments e where e.company_id = ${companies.id})`,
  ];
  const filters: Record<string, SQL> = {
    due: dueCondition(now),
    scheduled: and(inArray(companies.status, ["retry", "followup"]), gt(companies.nextActionAt, now))!,
    visit: eq(companies.status, "visit"),
    done: inArray(companies.status, CLOSED_STATUSES),
  };
  const attemptsFilter: Record<string, SQL> = {
    "0": eq(companies.attempts, 0),
    "1": eq(companies.attempts, 1),
    "2": eq(companies.attempts, 2),
    "3": gte(companies.attempts, 3),
  };
  const att = sp.att && attemptsFilter[sp.att] ? sp.att : "";
  // Open SIGTUR requests first, the closest (or most overdue) deadline first.
  const openRequestFirst = sql`case when ${companies.sigturRequest} = 1 and ${companies.requestResolvedAt} is null then 0 else 1 end`;
  const requestDueOrder = sql`case when ${companies.sigturRequest} = 1 and ${companies.requestResolvedAt} is null then coalesce(${companies.requestDueDate}, substr(${companies.requestedAt}, 1, 10)) end`;
  // "Para hoy": calls requested from SIGTUR first, then never-called tasks, then the ones waiting longest; same-company tasks stay together.
  const waitingSince = sql`coalesce(${companies.lastCalledAt}, ${companies.assignedAt}, '')`;
  const order =
    tab === "due"
      ? [openRequestFirst, requestDueOrder, sql`case when ${companies.attempts} = 0 then 0 else 1 end`, asc(waitingSince), asc(companies.priority), asc(rncKey), asc(companies.id)]
      : [sql`case when ${companies.nextActionAt} is null then 1 else 0 end`, asc(companies.nextActionAt), asc(companies.priority), asc(rncKey), asc(companies.id)];
  // Tab counts, the attention notice and the list are asked for at the same time.
  const [counts, attention, rows, agents] = await Promise.all([
    Promise.all(TABS.map(async (k) => [k, Number((await db.select({ n: sql<number>`count(*)` }).from(companies).where(and(...base, filters[k])))[0].n)] as const)).then(Object.fromEntries),
    attentionSummary(agentId, campaignIds),
    db
      .select()
      .from(companies)
      .where(and(...base, filters[tab], ...(att ? [attemptsFilter[att]] : [])))
      .orderBy(...order)
      .limit(limit + 1),
    isManager ? db.select().from(users).where(eq(users.active, true)).orderBy(asc(users.name)) : Promise.resolve([]),
  ]);
  const hasMore = rows.length > limit;
  const list = rows.slice(0, limit);
  const ids = list.map((r) => r.id);
  const [ests, phs, siblings] = ids.length
    ? await Promise.all([
        db.select({ companyId: establishments.companyId, name: establishments.nombreComercial, rut: establishments.rut, status: establishments.estatusRnt, municipio: establishments.municipio }).from(establishments).where(inArray(establishments.companyId, ids)),
        db.select({ companyId: phones.companyId, number: phones.number, quality: phones.quality }).from(phones).where(and(inArray(phones.companyId, ids), eq(phones.active, true))),
        db
          .select({ campaignId: companies.campaignId, k: rncKey, n: sql<number>`count(*)` })
          .from(companies)
          .where(inArray(companies.campaignId, campaignIds.length ? campaignIds : [-1]))
          .groupBy(companies.campaignId, rncKey),
      ])
    : [[], [], []];
  const estBy = new Map(ests.map((e) => [e.companyId, e]));
  const phBy = new Map<number, typeof phs>();
  for (const p of phs) phBy.set(p.companyId, [...(phBy.get(p.companyId) ?? []), p]);
  const sibCount = new Map(siblings.filter((s) => s.k.length >= 5).map((s) => [`${s.campaignId}|${s.k}`, s.n - 1]));
  const campaignName = new Map(open.map((c) => [c.id, c.name]));
  const qs = (o: Record<string, string>) => "?" + new URLSearchParams({ ...(sp as Record<string, string>), ...o }).toString();
  const tabLabels: Record<string, string> = { due: t.dueNow, scheduled: t.scheduled, visit: t.sentToVisit, done: t.finished };
  const viewing = agents.find((a) => a.id === agentId);

  return (
    <div className="space-y-6">
      <div className="page-title">
        <div>
          <h1>{t.hello}, {(viewing ?? me).name.split(" ")[0]} 👋</h1>
          <p className="subtitle">{t.queueSubtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isManager && <Link href={`/agents/${me.id}`} className="btn-secondary"><BarChart3 className="h-4 w-4" />{t.mySummary}</Link>}
          {(open.length > 1 || isManager) && (
            <form className="flex flex-wrap gap-2">
              <input type="hidden" name="tab" value={tab} />
              {open.length > 1 && (
                <select name="campaign" defaultValue={sp.campaign ?? ""} className="input w-56">
                  <option value="">{t.navCampaigns}: {t.all}</option>
                  {open.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
              {isManager && (
                <select name="agent" defaultValue={String(agentId)} className="input w-48">
                  {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              )}
              <button className="btn-secondary">{t.filter}</button>
            </form>
          )}
          <RefreshButton label={t.refresh} />
        </div>
      </div>

      {warnings.map((c) => (
        <p key={c.id} className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span><b>{c.name}</b>: {c.status === "draft" ? t.campaignDraftWarning : t.outsideDates}</span>
        </p>
      ))}

      {attention.total > 0 && (
        <p role="status" className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <BellRing className="h-5 w-5 shrink-0 text-mitur-orange" />
          <span>
            {t.attentionBanner
              .replace("{n}", plural(attention.total, t.attCallOne, t.attCallMany))
              .replace("{f}", plural(attention.overdueFollowups, t.attFollowupOne, t.attFollowupMany))
              .replace("{p}", plural(attention.dueToday, t.attPendingOne, t.attPendingMany))}
          </span>
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="segmented">
          {TABS.map((k) => (
            <Link key={k} href={qs({ tab: k, limit: "" })} aria-current={tab === k ? "page" : undefined}>
              {tabLabels[k]} <span className={`ml-1 rounded-full px-1.5 py-0.5 text-xs ${k === "due" && counts[k] > 0 ? "bg-mitur-red text-white" : "bg-slate-200/70 text-slate-600"}`}>{counts[k]}</span>
            </Link>
          ))}
        </nav>
        <nav className="flex flex-wrap items-center gap-1.5 text-sm" aria-label={t.attemptsFilter}>
          <span className="mr-1 text-slate-500">{t.attemptsFilter}:</span>
          {[["", t.all], ["0", t.attemptsNone], ["1", "1"], ["2", "2"], ["3", t.attempts3]].map(([v, l]) => (
            <Link key={v} href={qs({ att: v, limit: "" })} className={`rounded-full px-3 py-1 ${att === v ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>{l}</Link>
          ))}
        </nav>
      </div>

      {list.length === 0 ? (
        <Empty>{t.noCalls}</Empty>
      ) : (
        <div className="grid gap-3">
          {list.map((c) => {
            const e = estBy.get(c.id);
            const name = e?.name ?? c.razonSocial ?? c.key;
            const sib = sibCount.get(`${c.campaignId}|${(c.rnc ?? "").replace(/[-\s.]/g, "")}`) ?? 0;
            const nums = phBy.get(c.id) ?? [];
            // A follow-up whose date has come is highlighted wherever it is in the list.
            const followupDue = c.status === "followup" && !!c.nextActionAt && c.nextActionAt <= now;
            const overdueDays = followupDue ? daysSince(c.nextActionAt) ?? 0 : 0;
            const waited = daysSince(c.lastCalledAt ?? c.assignedAt);
            return (
              <Link key={c.id} href={`/calls/${c.id}`} className={`card group flex flex-wrap items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:shadow-md ${followupDue ? "border-mitur-yellow bg-amber-50/60 ring-2 ring-mitur-yellow/60" : "hover:border-brand-200"}`}>
                <Avatar name={name} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-base font-semibold text-slate-900">{name}</span>
                    <PriorityBadge p={c.priority} />
                    {c.whatsappSuggested && <span className="badge bg-green-50 text-green-700"><MessageCircle className="h-3 w-3" />WhatsApp</span>}
                    {c.sigturRequest && <SigturTag by={c.requestedBy} reason={c.requestReason} t={t} deadline={requestDeadline(c)} lang={lang} />}
                    {c.attempts === 0 && tab === "due" && <span className="badge bg-brand-600 text-white"><Sparkles className="h-3 w-3" />{t.newTask}</span>}
                    {followupDue && (
                      <span className="badge bg-mitur-yellow text-slate-900"><BellRing className="h-3 w-3" />
                        {overdueDays === 0 ? t.followupToday : overdueDays === 1 ? t.followupOverdueOne : t.followupOverdue.replace("{n}", String(overdueDays))}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-sm text-slate-500">
                    {c.razonSocial}{e?.municipio ? ` · ${e.municipio}` : ""}{open.length > 1 ? ` · ${campaignName.get(c.campaignId)}` : ""}
                  </div>
                  {c.sigturRequest && (c.requestedBy || c.requestReason) && (
                    <div className="mt-1 text-sm text-purple-800">
                      {c.requestedBy ? t.sigturRequestBy.replace("{who}", c.requestedBy) : ""}{c.requestedBy && c.requestReason ? " · " : ""}{c.requestReason}
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    {e?.status && <span className={`badge ${e.status === "Vencida" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>{e.status}</span>}
                    {sib > 0 && <span className="badge bg-brand-50 text-brand-700"><Building2 className="h-3 w-3" />+{sib} {t.ofSameCompany}</span>}
                    {nums.slice(0, 2).map((p) => (
                      <span key={p.number} className={`badge bg-slate-100 font-mono text-slate-700 ${p.quality === "ok" || p.quality === "invalid" ? "" : "line-through opacity-60"}`}>
                        <Phone className="h-3 w-3" />{p.number}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right text-xs text-slate-500">
                    <StatusBadge status={c.status} label={label(COMPANY_STATUSES, c.status, lang)} />
                    <div className="mt-1.5">{c.lastCode ? `${t.lastCall}: ${codeLabel(c.lastCode, lang)}` : t.noAnswerYet}</div>
                    {tab === "due" && waited != null && (
                      <div className={`mt-0.5 font-medium ${waited >= 3 ? "text-mitur-red" : "text-slate-600"}`}>
                        {waited === 0 ? t.waitingToday : waited === 1 ? t.waitingOne : t.waitingDays.replace("{n}", String(waited))}
                      </div>
                    )}
                    {c.nextActionAt && <div className="mt-0.5 flex items-center justify-end gap-1"><Clock className="h-3 w-3" />{fmtDateTime(c.nextActionAt, lang)}</div>}
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-300 transition group-hover:text-brand-500" />
                </div>
              </Link>
            );
          })}
          {hasMore && (
            <Link href={qs({ limit: String(limit + PAGE) })} className="btn-secondary mx-auto">{lang === "es" ? "Ver más" : "Show more"}</Link>
          )}
        </div>
      )}
    </div>
  );
}
