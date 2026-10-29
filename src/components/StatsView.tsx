import { CalendarClock, CheckCircle2, CircleAlert, MousePointerClick } from "lucide-react";
import Link from "next/link";
import { codeLabel, codeTone, COMPANY_STATUSES, label, OPERATION_LABELS, type Lang } from "@/lib/catalog";
import type { Dict } from "@/lib/i18n";
import type { Breakdown, Stats } from "@/lib/stats";
import { DashTabs } from "./DashTabs";
import { DayChart } from "./DayChart";
import { fmtPct, pct } from "./ui";

// Ministerio de Turismo palette (from the logo).
const C = { blue: "#0b4a92", sky: "#aecbec", yellow: "#f5c400", orange: "#f39019", red: "#d81e1e", green: "#2e9e44", grey: "#94a3b8" };
export const TONE_COLOR = { good: C.green, info: C.blue, warn: C.orange, bad: C.red, none: C.grey };
const STATUS_COLOR: Record<string, string> = { pending: C.grey, retry: C.yellow, followup: C.blue, visit: C.orange, done: C.green, transferred: "#a78bfa" };

// Builds the address of the list behind a number; null when the dashboard has no lists.
type Href = (p: { m?: string; d?: string; v?: string }) => string | null;
function makeHref(base?: string): Href {
  return (p) => {
    if (!base) return null;
    const [path, query] = base.split("?");
    const qs = new URLSearchParams(query);
    for (const [k, v] of Object.entries(p)) if (v) qs.set(k, v);
    return `${path}?${qs}`;
  };
}

function Maybe({ href, className, children, title }: { href: string | null; className?: string; children: React.ReactNode; title?: string }) {
  return href ? <Link href={href} className={className} title={title}>{children}</Link> : <div className={className} title={title}>{children}</div>;
}

function GoalCard({ title, help, n, d, target, t, href }: { title: string; help: string; n: number; d: number; target: number; t: Dict; href: string | null }) {
  const value = pct(n, d);
  const met = d > 0 && value >= target;
  const color = d === 0 ? C.grey : met ? C.green : C.orange;
  return (
    <Maybe href={href} className="card flex flex-col gap-3 p-5 transition hover:border-brand-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-semibold text-slate-700">{title}</div>
        {d > 0 && (met ? <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color }} aria-label={t.goalMet} /> : <CircleAlert className="h-5 w-5 shrink-0" style={{ color }} aria-label={t.goalPending} />)}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold tabular-nums text-slate-900">{d ? `${value.toLocaleString()} %` : "—"}</span>
        <span className="text-xs text-slate-500">{n} {t.of} {d}</span>
      </div>
      <div className="relative h-2 rounded-full bg-slate-100">
        <div className="h-2 rounded-full transition-all" style={{ width: `${Math.min(100, value)}%`, background: color }} />
        {/* target marker */}
        <div className="absolute -top-1 h-4 w-0.5 rounded bg-slate-700/70" style={{ left: `calc(${Math.min(100, target)}% - 1px)` }} title={`${t.target} ${target} %`} />
      </div>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{help}</span>
        <span className="shrink-0 font-medium text-slate-600">{t.target} {target === 100 ? "" : "≥ "}{target} %</span>
      </div>
    </Maybe>
  );
}

function MiniGoal({ title, n, d, target, t, href }: { title: string; n: number; d: number; target?: number; t: Dict; href: string | null }) {
  const value = pct(n, d);
  const color = target == null || d === 0 ? C.blue : value >= target ? C.green : C.orange;
  return (
    <Maybe href={href} className="-mx-2 block space-y-1.5 rounded-xl px-2 py-1 transition hover:bg-slate-50">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-slate-600">{title}</span>
        <span className="font-semibold tabular-nums text-slate-900">{fmtPct(n, d)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100"><div className="h-1.5 rounded-full" style={{ width: `${Math.min(100, value)}%`, background: color }} /></div>
      <div className="flex justify-between text-xs text-slate-400"><span>{n} {t.of} {d}</span>{target != null && <span>{t.target} {target === 100 ? "" : "≥ "}{target} %</span>}</div>
    </Maybe>
  );
}

export function HBars({ rows, total }: { rows: { label: string; n: number; color?: string; href?: string | null }[]; total: number }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <Maybe key={r.label} href={r.href ?? null} className="-mx-2 block rounded-xl px-2 py-1 text-sm transition hover:bg-slate-50">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="truncate text-slate-700" title={r.label}>{r.label}</span>
            <span className="shrink-0 tabular-nums text-slate-900">{r.n} <span className="text-xs text-slate-400">{fmtPct(r.n, total)}</span></span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full" style={{ width: `${(r.n / max) * 100}%`, background: r.color ?? C.blue }} />
          </div>
        </Maybe>
      ))}
    </div>
  );
}

// One bar split by task status, with a legend underneath.
function StackedBar({ parts, total }: { parts: { label: string; n: number; color: string; href: string | null }[]; total: number }) {
  return (
    <div className="space-y-4">
      <div className="flex h-4 overflow-hidden rounded-full bg-slate-100">
        {parts.map((p) => p.n > 0 && <div key={p.label} style={{ width: `${(p.n / Math.max(1, total)) * 100}%`, background: p.color }} title={`${p.label}: ${p.n}`} />)}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {parts.map((p) => (
          <li key={p.label}>
            <Maybe href={p.href} className="-mx-2 flex items-center justify-between gap-2 rounded-lg px-2 py-0.5 transition hover:bg-slate-50">
              <span className="flex items-center gap-2 text-slate-600"><span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />{p.label}</span>
              <span className="tabular-nums text-slate-900">{p.n}</span>
            </Maybe>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BreakdownTable({ rows, t, dim, href }: { rows: Breakdown[]; t: Dict; dim: string; href: Href }) {
  const cell = (r: Breakdown, m: string, n: number) => {
    const h = href({ d: dim, v: r.key, m });
    return h ? <Link href={h} className="font-medium text-brand-700 hover:underline">{n}</Link> : n;
  };
  return (
    <table className="table">
      <thead>
        <tr><th></th><th className="text-right">{t.universe}</th><th className="text-right">{t.called}</th><th className="text-right">{t.contacts}</th><th className="text-right">{t.opYes}</th><th className="text-right">{t.commitments}</th><th className="text-right">{t.closed}</th></tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key}>
            <td className="max-w-[18rem] truncate font-medium text-slate-800" title={r.key}>{r.key}</td>
            <td className="text-right tabular-nums">{cell(r, "all", r.universe)}</td>
            <td className="text-right tabular-nums">
              <div className="flex items-center justify-end gap-2">
                <span className="hidden h-1.5 w-16 rounded-full bg-slate-100 sm:block"><span className="block h-1.5 rounded-full" style={{ width: `${pct(r.called, r.universe)}%`, background: C.blue }} /></span>
                {cell(r, "called", r.called)}
              </div>
            </td>
            <td className="text-right tabular-nums">{cell(r, "contacted", r.contacted)}</td>
            <td className="text-right tabular-nums">{cell(r, "operating", r.operating)}</td>
            <td className="text-right tabular-nums">{cell(r, "commitments", r.commitments)}</td>
            <td className="text-right tabular-nums">{cell(r, "closed", r.closed)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// agentHref: where an agent's name leads («Resumen del agente»), with {id} for the person.
export function StatsView({ s, t, lang, period, listHref, agentHref }: { s: Stats; t: Dict; lang: Lang; period?: { progress: number; daysLeft: number }; listHref?: string; agentHref?: string }) {
  if (s.universe === 0) return <div className="card text-sm text-slate-500">{t.noData}</div>;
  const href = makeHref(listHref);
  const counts: [string, number, string | undefined, string | null][] = [
    [t.universe, s.universe, `${s.companies} ${t.companies.toLowerCase()}`, href({ m: "all" })],
    [t.calls, s.attempts, undefined, href({ m: "called" })],
    [t.kpiClosed, s.closed, undefined, href({ m: "closed" })],
    [t.kpiVisit, s.needVisit, `${s.visitsDone} ${t.visitsDone.toLowerCase()}`, href({ m: "needVisit" })],
    [t.emailsSent, s.emailsSent, undefined, href({ m: "emailsSent" })],
    [t.emailsBounced, s.emailsBounced, undefined, href({ m: "bounced" })],
  ];
  const statusParts = ["pending", "retry", "followup", "visit", "done", "transferred"].map((k) => ({
    label: label(COMPANY_STATUSES, k, lang),
    n: s.companiesByStatus.find((x) => x.key === k)?.n ?? 0,
    color: STATUS_COLOR[k],
    href: href({ d: "status", v: k }),
  }));

  const OP_COLOR: Record<string, string> = { yes: C.green, no: C.red, unknown: C.yellow, none: "#cbd5e1" };
  const operationParts = s.byOperation.map((o) => ({ label: label(OPERATION_LABELS, o.key, lang), n: o.n, color: OP_COLOR[o.key], href: href({ d: "operation", v: o.key }) }));

  return (
    <div className="space-y-6">
      {/* The plan's 4 key goals */}
      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t.goalsTitle}</h2>
          {listHref && <span className="flex items-center gap-1.5 text-xs text-slate-500"><MousePointerClick className="h-3.5 w-3.5" />{t.clickToSee}</span>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <GoalCard title={t.kpiCalled} help={t.kpiCalledHelp} n={s.called} d={s.universe} target={100} t={t} href={href({ m: "called" })} />
          <GoalCard title={t.kpiContact} help={t.kpiContactHelp} n={s.contactedEffective} d={s.called} target={65} t={t} href={href({ m: "effective" })} />
          <GoalCard title={t.kpiCommitments} help={t.kpiCommitmentsHelp} n={s.commitments} d={s.operatingContacted} target={70} t={t} href={href({ m: "commitments" })} />
          <GoalCard title={t.kpiAdvanceExpired} help={t.kpiAdvanceExpiredHelp} n={s.expiredInProcess} d={s.expiredOperating} target={80} t={t} href={href({ m: "expiredInProcess" })} />
        </div>
      </section>

      {/* Counts + other goals */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="card p-0">
          <div className="grid grid-cols-2 divide-slate-100 sm:grid-cols-3 sm:divide-x">
            {counts.map(([l, v, sub, h]) => (
              <Maybe key={l} href={h} className="border-b border-slate-100 px-5 py-4 transition hover:bg-slate-50">
                <div className="text-xs text-slate-500">{l}</div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{v}</div>
                {sub && <div className="text-xs text-slate-400">{sub}</div>}
              </Maybe>
            ))}
          </div>
          {period && (
            <div className="px-5 py-4">
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-slate-600"><CalendarClock className="h-4 w-4" />{t.campaignProgress}</span>
                <span className="text-slate-500">{period.progress} % · {period.daysLeft} {t.daysLeft}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full" style={{ width: `${period.progress}%`, background: `linear-gradient(90deg, ${C.blue}, ${C.yellow})` }} /></div>
            </div>
          )}
        </div>
        <div className="card space-y-4">
          <h3>{t.otherGoals}</h3>
          <MiniGoal title={t.kpiCompliance} n={s.commitmentsKept} d={s.commitmentsDue} target={60} t={t} href={href({ m: "commitmentsKept" })} />
          <MiniGoal title={t.kpiTypified} n={s.typified} d={s.universe} target={100} t={t} href={href({ m: "typified" })} />
          <MiniGoal title={t.kpiAdvanceNoLicense} n={s.noLicenseApplied} d={s.noLicenseOperating} target={50} t={t} href={href({ m: "noLicenseApplied" })} />
          <MiniGoal title={t.kpiCoverage} n={s.notified} d={s.universe} t={t} href={href({ m: "notified" })} />
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-4">{t.byCode}</h3>
          {s.byCode.length ? (
            <HBars total={s.universe} rows={s.byCode.map((c) => ({ label: codeLabel(c.code, lang), n: c.n, color: TONE_COLOR[codeTone(c.code)], href: href({ d: "code", v: c.code }) }))} />
          ) : (
            <p className="text-sm text-slate-500">{t.noData}</p>
          )}
        </div>
        <div className="card">
          <h3 className="mb-4">{t.byDay}</h3>
          {s.byDay.length ? <DayChart data={s.byDay} labels={{ calls: t.calls, contacts: t.contacts }} /> : <p className="text-sm text-slate-500">{t.noData}</p>}
        </div>
        <div className="card">
          <h3 className="mb-4">{t.companiesByStatus}</h3>
          <StackedBar parts={statusParts} total={s.companies} />
          <h3 className="mb-1 mt-6">{t.opTitle}</h3>
          <p className="mb-3 text-xs text-slate-500">{t.opHelp}</p>
          <StackedBar parts={operationParts} total={s.universe} />
        </div>
        <div className="card">
          <h3 className="mb-4">{t.byStatus}</h3>
          <HBars total={s.universe} rows={s.byStatus.map((r) => ({ label: r.key, n: r.n, color: r.key === "En proceso" || r.key === "Vigente" ? C.green : r.key === "Vencida" ? C.red : r.key === "Sin licencia" ? C.orange : C.blue, href: href({ d: "estatus", v: r.key }) }))} />
          {s.byChannel.length > 0 && (
            <>
              <h3 className="mb-4 mt-6">{t.byChannel}</h3>
              <HBars total={s.byChannel.reduce((a, b) => a + b.n, 0)} rows={s.byChannel.map((r) => ({ label: r.key, n: r.n, color: C.green, href: href({ d: "channel", v: r.key }) }))} />
            </>
          )}
        </div>
      </div>

      {/* Detail tables, one at a time */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{t.detailTitle}</h2>
        <DashTabs
          tabs={[
            {
              id: "agent",
              label: t.byAgent,
              content: (
                <table className="table">
                  <thead>
                    <tr><th>{t.agent}</th><th className="text-right">{t.companies}</th><th className="text-right">{t.finished}</th><th className="text-right">{t.calls}</th><th className="text-right">{t.contacts}</th><th className="text-right">{t.commitments}</th></tr>
                  </thead>
                  <tbody>
                    {s.byAgent.map((a) => (
                      <tr key={a.agent}>
                        <td className="font-medium text-slate-800">{agentHref ? <Link href={agentHref.replace("{id}", String(a.id))} className="text-brand-700 hover:underline" title={t.openAgentSummary.replace("{name}", a.agent)}>{a.agent}</Link> : a.agent}</td>
                        <td className="text-right tabular-nums">{href({ d: "agent", v: String(a.id) }) ? <Link href={href({ d: "agent", v: String(a.id) })!} className="font-medium text-brand-700 hover:underline">{a.companies}</Link> : a.companies}</td>
                        <td className="text-right tabular-nums">{a.done} <span className="text-xs text-slate-400">{fmtPct(a.done, a.companies)}</span></td>
                        <td className="text-right tabular-nums">{a.calls}</td>
                        <td className="text-right tabular-nums">{a.contacts} <span className="text-xs text-slate-400">{fmtPct(a.contacts, a.calls)}</span></td>
                        <td className="text-right tabular-nums">{a.commitments}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ),
            },
            { id: "zone", label: t.byZone, content: <BreakdownTable rows={s.byZone} t={t} dim="zone" href={href} /> },
            { id: "priority", label: t.byPriority, content: <BreakdownTable rows={s.byPriority} t={t} dim="priority" href={href} /> },
            { id: "subsector", label: t.bySubsector, content: <BreakdownTable rows={s.bySubsector} t={t} dim="subsector" href={href} /> },
          ]}
        />
      </section>
    </div>
  );
}
