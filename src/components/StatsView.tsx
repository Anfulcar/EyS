import { CalendarClock, CheckCircle2, CircleAlert } from "lucide-react";
import { codeLabel, codeTone, COMPANY_STATUSES, label, type Lang } from "@/lib/catalog";
import type { Dict } from "@/lib/i18n";
import type { Breakdown, Stats } from "@/lib/stats";
import { DashTabs } from "./DashTabs";
import { DayChart } from "./DayChart";
import { fmtPct, pct } from "./ui";

// Ministerio de Turismo palette (from the logo).
const C = { blue: "#0b4a92", sky: "#aecbec", yellow: "#f5c400", orange: "#f39019", red: "#d81e1e", green: "#2e9e44", grey: "#94a3b8" };
const TONE_COLOR = { good: C.green, info: C.blue, warn: C.orange, bad: C.red, none: C.grey };
const STATUS_COLOR: Record<string, string> = { pending: C.grey, retry: C.yellow, followup: C.blue, visit: C.orange, done: C.green };

function GoalCard({ title, help, n, d, target, t }: { title: string; help: string; n: number; d: number; target: number; t: Dict }) {
  const value = pct(n, d);
  const met = d > 0 && value >= target;
  const color = d === 0 ? C.grey : met ? C.green : C.orange;
  return (
    <div className="card flex flex-col gap-3 p-5">
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
    </div>
  );
}

function MiniGoal({ title, n, d, target, t }: { title: string; n: number; d: number; target?: number; t: Dict }) {
  const value = pct(n, d);
  const color = target == null || d === 0 ? C.blue : value >= target ? C.green : C.orange;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-slate-600">{title}</span>
        <span className="font-semibold tabular-nums text-slate-900">{fmtPct(n, d)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100"><div className="h-1.5 rounded-full" style={{ width: `${Math.min(100, value)}%`, background: color }} /></div>
      <div className="flex justify-between text-xs text-slate-400"><span>{n} {t.of} {d}</span>{target != null && <span>{t.target} {target === 100 ? "" : "≥ "}{target} %</span>}</div>
    </div>
  );
}

function HBars({ rows, total }: { rows: { label: string; n: number; color?: string }[]; total: number }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.label} className="text-sm">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="truncate text-slate-700" title={r.label}>{r.label}</span>
            <span className="shrink-0 tabular-nums text-slate-900">{r.n} <span className="text-xs text-slate-400">{fmtPct(r.n, total)}</span></span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full" style={{ width: `${(r.n / max) * 100}%`, background: r.color ?? C.blue }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// One bar split by task status, with a legend underneath.
function StackedBar({ parts, total }: { parts: { label: string; n: number; color: string }[]; total: number }) {
  return (
    <div className="space-y-4">
      <div className="flex h-4 overflow-hidden rounded-full bg-slate-100">
        {parts.map((p) => p.n > 0 && <div key={p.label} style={{ width: `${(p.n / Math.max(1, total)) * 100}%`, background: p.color }} title={`${p.label}: ${p.n}`} />)}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-slate-600"><span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />{p.label}</span>
            <span className="tabular-nums text-slate-900">{p.n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BreakdownTable({ rows, t }: { rows: Breakdown[]; t: Dict }) {
  return (
    <table className="table">
      <thead>
        <tr><th></th><th className="text-right">{t.universe}</th><th className="text-right">{t.called}</th><th className="text-right">{t.contacts}</th><th className="text-right">{t.commitments}</th><th className="text-right">{t.closed}</th></tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key}>
            <td className="max-w-[18rem] truncate font-medium text-slate-800" title={r.key}>{r.key}</td>
            <td className="text-right tabular-nums">{r.universe}</td>
            <td className="text-right tabular-nums">
              <div className="flex items-center justify-end gap-2">
                <span className="hidden h-1.5 w-16 rounded-full bg-slate-100 sm:block"><span className="block h-1.5 rounded-full" style={{ width: `${pct(r.called, r.universe)}%`, background: C.blue }} /></span>
                {r.called}
              </div>
            </td>
            <td className="text-right tabular-nums">{r.contacted}</td>
            <td className="text-right tabular-nums">{r.commitments}</td>
            <td className="text-right tabular-nums">{r.closed}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function StatsView({ s, t, lang, period }: { s: Stats; t: Dict; lang: Lang; period?: { progress: number; daysLeft: number } }) {
  if (s.universe === 0) return <div className="card text-sm text-slate-500">{t.noData}</div>;
  const counts: [string, number, string?][] = [
    [t.universe, s.universe, `${s.companies} ${t.companies.toLowerCase()}`],
    [t.calls, s.attempts],
    [t.kpiClosed, s.closed],
    [t.kpiVisit, s.needVisit, `${s.visitsDone} ${t.visitsDone.toLowerCase()}`],
    [t.emailsSent, s.emailsSent],
    [t.emailsBounced, s.emailsBounced],
  ];
  const statusParts = ["pending", "retry", "followup", "visit", "done"].map((k) => ({
    label: label(COMPANY_STATUSES, k, lang),
    n: s.companiesByStatus.find((x) => x.key === k)?.n ?? 0,
    color: STATUS_COLOR[k],
  }));

  return (
    <div className="space-y-6">
      {/* The plan's 4 key goals */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{t.goalsTitle}</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <GoalCard title={t.kpiCalled} help={t.kpiCalledHelp} n={s.called} d={s.universe} target={100} t={t} />
          <GoalCard title={t.kpiContact} help={t.kpiContactHelp} n={s.contactedEffective} d={s.called} target={65} t={t} />
          <GoalCard title={t.kpiCommitments} help={t.kpiCommitmentsHelp} n={s.commitments} d={s.operatingContacted} target={70} t={t} />
          <GoalCard title={t.kpiAdvanceExpired} help={t.kpiAdvanceExpiredHelp} n={s.expiredInProcess} d={s.expiredOperating} target={80} t={t} />
        </div>
      </section>

      {/* Counts + other goals */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="card p-0">
          <div className="grid grid-cols-2 divide-slate-100 sm:grid-cols-3 sm:divide-x">
            {counts.map(([l, v, sub]) => (
              <div key={l} className="border-b border-slate-100 px-5 py-4">
                <div className="text-xs text-slate-500">{l}</div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{v}</div>
                {sub && <div className="text-xs text-slate-400">{sub}</div>}
              </div>
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
          <MiniGoal title={t.kpiCompliance} n={s.commitmentsKept} d={s.commitmentsDue} target={60} t={t} />
          <MiniGoal title={t.kpiTypified} n={s.typified} d={s.universe} target={100} t={t} />
          <MiniGoal title={t.kpiAdvanceNoLicense} n={s.noLicenseApplied} d={s.noLicenseOperating} target={50} t={t} />
          <MiniGoal title={t.kpiCoverage} n={s.notified} d={s.universe} t={t} />
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-4">{t.byCode}</h3>
          {s.byCode.length ? (
            <HBars total={s.universe} rows={s.byCode.map((c) => ({ label: codeLabel(c.code, lang), n: c.n, color: TONE_COLOR[codeTone(c.code)] }))} />
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
        </div>
        <div className="card">
          <h3 className="mb-4">{t.byStatus}</h3>
          <HBars total={s.universe} rows={s.byStatus.map((r) => ({ label: r.key, n: r.n, color: r.key === "En proceso" || r.key === "Vigente" ? C.green : r.key === "Vencida" ? C.red : r.key === "Sin licencia" ? C.orange : C.blue }))} />
          {s.byChannel.length > 0 && (
            <>
              <h3 className="mb-4 mt-6">{t.byChannel}</h3>
              <HBars total={s.byChannel.reduce((a, b) => a + b.n, 0)} rows={s.byChannel.map((r) => ({ label: r.key, n: r.n, color: C.green }))} />
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
                        <td className="font-medium text-slate-800">{a.agent}</td>
                        <td className="text-right tabular-nums">{a.companies}</td>
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
            { id: "zone", label: t.byZone, content: <BreakdownTable rows={s.byZone} t={t} /> },
            { id: "priority", label: t.byPriority, content: <BreakdownTable rows={s.byPriority} t={t} /> },
            { id: "subsector", label: t.bySubsector, content: <BreakdownTable rows={s.bySubsector} t={t} /> },
          ]}
        />
      </section>
    </div>
  );
}
