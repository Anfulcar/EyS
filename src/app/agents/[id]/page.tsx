import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { BackLink } from "@/components/BackLink";
import { CallsTable } from "@/components/CallsTable";
import { DayChart } from "@/components/DayChart";
import { HBars, TONE_COLOR } from "@/components/StatsView";
import { Empty } from "@/components/ui";
import { db } from "@/db";
import { campaigns, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { agentSummary } from "@/lib/agent-summary";
import { CALL_CODES, codeLabel, codeTone, ROLES, label } from "@/lib/catalog";
import { toIsoDate } from "@/lib/dates";
import { getDict } from "@/lib/i18n-server";
import { callRows } from "@/lib/reviews";
import { absentOn } from "@/lib/team";

const PAGE = 100;

// «Resumen del agente»: supervisors and administrators open anyone's; agents only their own (others: not found).
export default async function AgentSummaryPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ campaign?: string; from?: string; to?: string; code?: string; review?: string; page?: string }>;
}) {
  const me = await requireUser(["admin", "supervisor", "agent"]);
  const id = Number((await params).id);
  if (!Number.isInteger(id) || (me.role === "agent" && id !== me.id)) notFound();
  const person = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!person) notFound();
  const sp = await searchParams;
  const { t, lang } = await getDict();
  const campaignId = Number(sp.campaign) || undefined;
  const from = toIsoDate(sp.from ?? "") ?? undefined;
  const to = toIsoDate(sp.to ?? "") ?? undefined;
  const page = Math.max(0, Number(sp.page) || 0);
  const [campaign, s, rows, absent] = await Promise.all([
    campaignId ? db.query.campaigns.findFirst({ where: eq(campaigns.id, campaignId) }) : null,
    agentSummary(id, { campaignId, from, to }),
    // Same list and permission rules as «Llamadas realizadas», fixed to this person.
    callRows(me, { campaign: campaignId ? String(campaignId) : undefined, agent: String(id), code: sp.code, from, to, review: sp.review }, PAGE + 1, page * PAGE),
    absentOn(),
  ]);
  const clean = Object.fromEntries(Object.entries(sp).filter(([, v]) => v)) as Record<string, string>;
  const qs = (o: Record<string, string | undefined>) => "?" + new URLSearchParams(Object.entries({ ...clean, ...o }).filter(([, v]) => v) as [string, string][]).toString();
  const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)} %` : "—");
  const off = absent.get(id);
  const hasMore = rows.length > PAGE;
  const Kpi = ({ n, l, sub, tone }: { n: number; l: string; sub?: string; tone?: string }) => (
    <div className="card p-4">
      <div className={`text-2xl font-bold tabular-nums ${tone ?? "text-slate-900"}`}>{n}{sub && <span className="ml-1 text-sm font-medium text-slate-400">{sub}</span>}</div>
      <div className="text-xs text-slate-500">{l}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <BackLink label={t.back} />
      <div className="page-title">
        <div className="flex items-center gap-4">
          <Avatar name={person.name} size="lg" />
          <div>
            <h1>{person.name}</h1>
            <p className="subtitle">
              {label(ROLES, person.role, lang)} · {off ? t.absentTag : t.agentAvailable} · {campaign ? `${t.campaign}: ${campaign.name}` : t.allCampaigns}
              {campaign && <> · <Link href={qs({ campaign: undefined, page: undefined })} className="text-brand-700 hover:underline">{t.seeAllCampaigns}</Link></>}
            </p>
          </div>
        </div>
        <form className="flex flex-wrap items-end gap-2">
          {campaignId && <input type="hidden" name="campaign" value={campaignId} />}
          <div><label className="label" htmlFor="ag-from">{t.from}</label><input id="ag-from" type="date" name="from" defaultValue={from} className="input" /></div>
          <div><label className="label" htmlFor="ag-to">{t.to}</label><input id="ag-to" type="date" name="to" defaultValue={to} className="input" /></div>
          <button className="btn-secondary">{t.filter}</button>
        </form>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6" data-testid="agent-kpis">
        <Kpi n={s.tasks} l={t.agentTasks} />
        <Kpi n={s.open} l={t.agentOpenDue.replace("{n}", String(s.dueToday))} />
        <Kpi n={s.calls} l={t.agentCallsToday.replace("{n}", String(s.callsToday))} />
        <Kpi n={s.contacts} sub={pct(s.contacts, s.calls)} l={t.contacts} />
        <Kpi n={s.commitments} l={t.commitments} />
        <Kpi n={s.notReviewed} l={t.notReviewed} tone={s.notReviewed ? "text-amber-700" : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-4">{t.agentResults}</h3>
          {s.byCode.length ? (
            <HBars total={s.calls} rows={s.byCode.map((c) => ({ label: codeLabel(c.code, lang), n: c.n, color: TONE_COLOR[codeTone(c.code)], href: qs({ code: c.code, page: undefined }) + "#calls" }))} />
          ) : (
            <p className="text-sm text-slate-500">{t.noData}</p>
          )}
        </div>
        <div className="card">
          <h3 className="mb-4">{t.byDay}</h3>
          {s.byDay.length ? <DayChart data={s.byDay} labels={{ calls: t.calls, contacts: t.contacts }} /> : <p className="text-sm text-slate-500">{t.noData}</p>}
        </div>
      </div>

      <section id="calls" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-base">{t.agentCallsTitle.replace("{name}", person.name)}</h2>
          <form className="flex flex-wrap items-end gap-2">
            {campaignId && <input type="hidden" name="campaign" value={campaignId} />}
            {from && <input type="hidden" name="from" value={from} />}
            {to && <input type="hidden" name="to" value={to} />}
            <div>
              <label className="label" htmlFor="ag-code">{t.result}</label>
              <select id="ag-code" name="code" defaultValue={sp.code ?? ""} className="input">
                <option value="">{t.all}</option>
                {Object.entries(CALL_CODES).map(([k, v]) => <option key={k} value={k}>{v[lang]}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="ag-review">{t.reviewState}</label>
              <select id="ag-review" name="review" defaultValue={sp.review ?? ""} className="input">
                <option value="">{t.all}</option>
                <option value="no">{t.notReviewed}</option>
                <option value="yes">{t.reviewed}</option>
              </select>
            </div>
            <button className="btn-secondary">{t.filter}</button>
          </form>
        </div>
        {rows.length === 0 ? (
          <Empty>{t.noCallsFound}</Empty>
        ) : (
          <CallsTable
            rows={rows.slice(0, PAGE)}
            t={t}
            lang={lang}
            showAgent={false}
            pager={(page > 0 || hasMore) && (
              <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
                {page > 0 ? <Link className="btn-secondary btn-sm" href={qs({ page: String(page - 1) }) + "#calls"}>←</Link> : <span />}
                <span className="text-slate-500">{page * PAGE + 1}–{page * PAGE + Math.min(rows.length, PAGE)}</span>
                {hasMore ? <Link className="btn-secondary btn-sm" href={qs({ page: String(page + 1) }) + "#calls"}>{t.seeMore} →</Link> : <span />}
              </div>
            )}
          />
        )}
      </section>
    </div>
  );
}
