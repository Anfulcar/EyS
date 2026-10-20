import { codeLabel, COMPANY_STATUSES, label, type Lang } from "@/lib/catalog";
import type { Dict } from "@/lib/i18n";
import type { Breakdown, Stats } from "@/lib/stats";
import { DayChart } from "./DayChart";
import { fmtPct, Kpi, pct } from "./ui";

function HBars({ rows, total }: { rows: { label: string; n: number; color?: string }[]; total: number }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-sm">
          <div>
            <div className="truncate text-slate-700" title={r.label}>{r.label}</div>
            <div className="mt-0.5 h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full" style={{ width: `${(r.n / max) * 100}%`, background: r.color ?? "#2563eb" }} />
            </div>
          </div>
          <div className="w-24 text-right tabular-nums text-slate-600">
            {r.n} <span className="text-xs text-slate-400">({fmtPct(r.n, total)})</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function BreakdownTable({ title, rows, t }: { title: string; rows: Breakdown[]; t: Dict }) {
  return (
    <div className="card overflow-x-auto p-0">
      <h3 className="px-4 pt-4">{title}</h3>
      <table className="table mt-2">
        <thead>
          <tr><th></th><th className="text-right">{t.universe}</th><th className="text-right">{t.called}</th><th className="text-right">{t.contacts}</th><th className="text-right">{t.commitments}</th><th className="text-right">{t.closed}</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="max-w-[16rem] truncate" title={r.key}>{r.key}</td>
              <td className="text-right tabular-nums">{r.universe}</td>
              <td className="text-right tabular-nums">{r.called} <span className="text-xs text-slate-400">{fmtPct(r.called, r.universe)}</span></td>
              <td className="text-right tabular-nums">{r.contacted}</td>
              <td className="text-right tabular-nums">{r.commitments}</td>
              <td className="text-right tabular-nums">{r.closed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const CODE_COLORS: Record<string, string> = {
  "01": "#15803d", "02": "#16a34a", "03": "#0ea5e9", "04": "#f59e0b", "05": "#64748b", "06": "#8b5cf6",
  "07": "#ef4444", "08": "#f97316", "09": "#b91c1c", "10": "#fb923c",
};

export function StatsView({ s, t, lang }: { s: Stats; t: Dict; lang: Lang }) {
  if (s.universe === 0) return <div className="card text-sm text-slate-500">{t.noData}</div>;
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label={t.kpiCalled} value={fmtPct(s.called, s.universe)} sub={`${s.called} / ${s.universe}`} target={`${t.target} 100 %`} pct={pct(s.called, s.universe)} />
        <Kpi label={t.kpiContact} value={fmtPct(s.contactedEffective, s.called)} sub={`${s.contactedEffective} / ${s.called}`} target={`${t.target} ≥ 65 %`} pct={pct(s.contactedEffective, s.called)} />
        <Kpi label={t.kpiCommitments} value={fmtPct(s.commitments, s.operatingContacted)} sub={`${s.commitments} / ${s.operatingContacted}`} target={`${t.target} ≥ 70 %`} pct={pct(s.commitments, s.operatingContacted)} />
        <Kpi label={t.kpiCompliance} value={fmtPct(s.commitmentsKept, s.commitmentsDue)} sub={`${s.commitmentsKept} / ${s.commitmentsDue}`} target={`${t.target} ≥ 60 %`} pct={pct(s.commitmentsKept, s.commitmentsDue)} />
        <Kpi label={t.kpiTypified} value={fmtPct(s.typified, s.universe)} sub={`${s.typified} / ${s.universe}`} target={`${t.target} 100 %`} pct={pct(s.typified, s.universe)} />
        <Kpi label={t.kpiCoverage} value={fmtPct(s.notified, s.universe)} sub={`${s.notified} / ${s.universe}`} />
        <Kpi label={t.kpiAdvanceExpired} value={fmtPct(s.expiredInProcess, s.expiredOperating)} sub={`${s.expiredInProcess} / ${s.expiredOperating}`} target={`${t.target} ≥ 80 %`} pct={pct(s.expiredInProcess, s.expiredOperating)} />
        <Kpi label={t.kpiAdvanceNoLicense} value={fmtPct(s.noLicenseApplied, s.noLicenseOperating)} sub={`${s.noLicenseApplied} / ${s.noLicenseOperating}`} target={`${t.target} ≥ 50 %`} pct={pct(s.noLicenseApplied, s.noLicenseOperating)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label={t.universe} value={s.universe} sub={`${s.companies} ${t.companies.toLowerCase()}`} />
        <Kpi label={t.calls} value={s.attempts} />
        <Kpi label={t.kpiClosed} value={s.closed} />
        <Kpi label={t.kpiVisit} value={s.needVisit} sub={`${s.visitsDone} ${t.visitsDone.toLowerCase()}`} />
        <Kpi label={t.emailsSent} value={s.emailsSent} />
        <Kpi label={t.emailsBounced} value={s.emailsBounced} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-3">{t.byCode}</h3>
          {s.byCode.length ? <HBars total={s.universe} rows={s.byCode.map((c) => ({ label: codeLabel(c.code, lang), n: c.n, color: CODE_COLORS[c.code] }))} /> : <p className="text-sm text-slate-500">{t.noData}</p>}
        </div>
        <div className="card">
          <h3 className="mb-3">{t.byDay}</h3>
          {s.byDay.length ? <DayChart data={s.byDay} labels={{ calls: t.calls, contacts: t.contacts }} /> : <p className="text-sm text-slate-500">{t.noData}</p>}
        </div>
        <div className="card">
          <h3 className="mb-3">{t.companiesByStatus}</h3>
          <HBars total={s.companies} rows={s.companiesByStatus.map((r) => ({ label: label(COMPANY_STATUSES, r.key, lang), n: r.n }))} />
        </div>
        <div className="card">
          <h3 className="mb-3">{t.byStatus}</h3>
          <HBars total={s.universe} rows={s.byStatus.map((r) => ({ label: r.key, n: r.n }))} />
          {s.byChannel.length > 0 && (
            <>
              <h3 className="mb-3 mt-5">{t.byChannel}</h3>
              <HBars total={s.byChannel.reduce((a, b) => a + b.n, 0)} rows={s.byChannel.map((r) => ({ label: r.key, n: r.n, color: "#0f766e" }))} />
            </>
          )}
        </div>
      </div>
      <div className="card overflow-x-auto p-0">
        <h3 className="px-4 pt-4">{t.byAgent}</h3>
        <table className="table mt-2">
          <thead>
            <tr><th>{t.agent}</th><th className="text-right">{t.companies}</th><th className="text-right">{t.finished}</th><th className="text-right">{t.calls}</th><th className="text-right">{t.contacts}</th><th className="text-right">{t.commitments}</th></tr>
          </thead>
          <tbody>
            {s.byAgent.map((a) => (
              <tr key={a.agent}>
                <td>{a.agent}</td>
                <td className="text-right tabular-nums">{a.companies}</td>
                <td className="text-right tabular-nums">{a.done} <span className="text-xs text-slate-400">{fmtPct(a.done, a.companies)}</span></td>
                <td className="text-right tabular-nums">{a.calls}</td>
                <td className="text-right tabular-nums">{a.contacts} <span className="text-xs text-slate-400">{fmtPct(a.contacts, a.calls)}</span></td>
                <td className="text-right tabular-nums">{a.commitments}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownTable title={t.byZone} rows={s.byZone} t={t} />
        <BreakdownTable title={t.byPriority} rows={s.byPriority} t={t} />
      </div>
      <BreakdownTable title={t.bySubsector} rows={s.bySubsector} t={t} />
    </div>
  );
}
