import Link from "next/link";
import { MultiSelect } from "@/components/MultiSelect";
import { fmtDate } from "@/lib/dates";
import { getDict } from "@/lib/i18n-server";
import { many } from "@/lib/multi";
import { qrStats, QR_TYPES } from "@/lib/qr";
import { requireQr } from "@/lib/qr-auth";
import { QR_CHANNEL_TEXT, QR_TEXT, QR_TYPE_TEXT } from "@/lib/qr-i18n";

const PERIODS = [30, 90, 180, 365];

// Horizontal bars as in the preview: name, bar and number on one line.
function Bars({ rows }: { rows: { label: string; n: number; href?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const inner = (
          <>
            <span className="truncate text-sm text-slate-700" title={r.label}>{r.label}</span>
            <span className="h-3 overflow-hidden rounded bg-slate-100"><span className="block h-full rounded-r bg-brand-600" style={{ width: `${(r.n / max) * 100}%` }} /></span>
            <b className="text-right text-sm tabular-nums">{r.n}</b>
          </>
        );
        const cls = "grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_2.5rem] items-center gap-3 rounded-lg px-1 py-0.5";
        return r.href ? <Link key={r.label} href={r.href} className={`${cls} hover:bg-slate-50`} title={`${r.label}: ${r.n}`}>{inner}</Link> : <div key={r.label} className={cls} title={`${r.label}: ${r.n}`}>{inner}</div>;
      })}
    </div>
  );
}

// Statistics of «Quejas y reclamaciones» (handlers and supervisors).
export default async function QrStatsPage({ searchParams }: { searchParams: Promise<{ days?: string; type?: string }> }) {
  await requireQr("manage");
  const sp = await searchParams;
  const { t: common, lang } = await getDict();
  const t = QR_TEXT[lang];
  const days = PERIODS.includes(Number(sp.days)) ? Number(sp.days) : 90;
  const types = many(sp.type).filter((x) => (QR_TYPES as readonly string[]).includes(x));
  const s = await qrStats({ days, types });
  const wmax = Math.max(1, ...s.weeks.map((w) => w.n));
  const pctTone = (v: number | null) => (v == null ? "bg-slate-100 text-slate-600" : v >= 90 ? "bg-emerald-50 text-emerald-700" : v >= 75 ? "bg-amber-50 text-amber-800" : "bg-red-50 text-mitur-red");
  const pctMark = (v: number | null) => (v == null ? "" : v >= 90 ? "✓ " : v >= 75 ? "! " : "✕ ");
  const fmtN = (v: number | null) => (v == null ? "—" : v.toLocaleString(lang === "es" ? "es-DO" : "en-US"));
  const typeQs = types.map((x) => `&type=${encodeURIComponent(x)}`).join("");

  return (
    <div className="space-y-5">
      <div className="page-title">
        <div><h1>{t.statsTitle}</h1><p className="subtitle">{t.statsSub}</p></div>
        <form className="flex flex-wrap items-end gap-2">
          <div><label className="label" htmlFor="st-days">{t.period}</label><select id="st-days" name="days" defaultValue={days} className="input w-44">{PERIODS.map((p, i) => <option key={p} value={p}>{[t.last30, t.last90, t.last180, t.last365][i]}</option>)}</select></div>
          <div><label className="label" htmlFor="st-type">{t.fType}</label><MultiSelect key={sp.type ?? ""} id="st-type" name="type" value={sp.type} options={QR_TYPES.map((x) => ({ value: x, label: QR_TYPE_TEXT[lang][x] }))} t={common} className="w-48" /></div>
          <button className="btn-secondary">{common.filter}</button>
          <a href={`/api/quejas/export?days=${days}${typeQs}`} className="btn-secondary">Excel</a>
        </form>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="qr-kpis">
        <div className="card p-4"><div className="text-2xl font-bold tabular-nums">{s.received}</div><div className="text-sm font-semibold text-slate-700">{t.kReceived}</div><div className="text-xs text-slate-500">{t.kOpenClosed.replace("{o}", String(s.open)).replace("{c}", String(s.closed))}</div></div>
        <div className="card p-4"><div className="text-2xl font-bold tabular-nums">{s.onTimePct == null ? "—" : `${s.onTimePct} %`}</div><div className="text-sm font-semibold text-slate-700">{t.kOnTime}</div><div className="text-xs text-slate-500">{t.kOnTimeSub.replace("{n}", String(s.onTime)).replace("{c}", String(s.closed))}</div></div>
        <div className="card p-4"><div className="text-2xl font-bold tabular-nums">{fmtN(s.avgDays)}</div><div className="text-sm font-semibold text-slate-700">{t.kAvg}</div><div className="text-xs text-slate-500">{t.kAvgSub}</div></div>
        <Link href="/quejas?status=late" className="card p-4 transition hover:border-brand-200"><div className={`text-2xl font-bold tabular-nums ${s.late ? "text-mitur-red" : ""}`}>{s.late}</div><div className="text-sm font-semibold text-slate-700">{t.kLate}</div><div className="text-xs text-slate-500">{t.kLateSub}</div></Link>
      </div>

      <div className="card space-y-3">
        <h3>{t.perWeek}</h3>
        <div className="grid h-40 grid-cols-12 items-end gap-1.5 border-b border-slate-200" role="img" aria-label={t.perWeek}>
          {s.weeks.map((w) => (
            <div key={w.start} className="flex h-full items-end" title={`${fmtDate(w.start, lang)}: ${w.n}`}>
              <div className="w-full rounded-t bg-brand-600" style={{ height: `${Math.max(2, (w.n / wmax) * 100)}%` }} />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-12 gap-1.5 text-center text-[11px] text-slate-500">{s.weeks.map((w, i) => <span key={w.start}>{i % 3 === 0 || i === 11 ? fmtDate(w.start, lang).replace(/ de \d{4}$|, \d{4}$/, "") : ""}</span>)}</div>
        <p className="text-xs text-slate-500">{t.perWeekSub.replace("{n}", String(wmax))}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card"><h3 className="mb-4">{t.byTopic}</h3>{s.byTopic.length ? <Bars rows={s.byTopic.map((r) => ({ label: r.key, n: r.n }))} /> : <p className="text-sm text-slate-500">{t.noData}</p>}</div>
        <div className="card"><h3 className="mb-4">{t.byChannel}</h3>{s.byChannel.length ? <Bars rows={s.byChannel.map((r) => ({ label: QR_CHANNEL_TEXT[lang][r.key] ?? r.key, n: r.n, href: `/quejas?status=open&status=cerrada&channel=${r.key}${typeQs}` }))} /> : <p className="text-sm text-slate-500">{t.noData}</p>}</div>
      </div>

      <div className="card overflow-hidden p-0">
        <h3 className="px-5 pt-5">{t.byType}</h3>
        <div className="overflow-x-auto">
          <table className="table" data-testid="qr-by-type">
            <thead><tr><th>{t.fType}</th><th className="text-right">{t.colReceived}</th><th className="text-right">{t.colOpen}</th><th className="text-right">{t.colClosed}</th><th className="text-right">{t.colAvg}</th><th className="text-right">{t.colSla}</th><th>{t.colOnTime}</th></tr></thead>
            <tbody>
              {s.byType.map((r) => (
                <tr key={r.type}>
                  <td className="font-medium">{QR_TYPE_TEXT[lang][r.type]}</td>
                  <td className="text-right tabular-nums">{r.received}</td><td className="text-right tabular-nums">{r.open}</td><td className="text-right tabular-nums">{r.closed}</td>
                  <td className="text-right tabular-nums">{fmtN(r.avgDays)}</td><td className="text-right tabular-nums">{r.sla == null ? "—" : t.days.replace("{n}", String(r.sla))}</td>
                  <td>{r.onTimePct == null ? "—" : <span className={`badge ${pctTone(r.onTimePct)}`}>{pctMark(r.onTimePct)}{r.onTimePct} %</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card overflow-hidden p-0">
          <h3 className="px-5 pt-5">{t.byRut}</h3>
          {s.byRut.length === 0 ? <p className="p-5 text-sm text-slate-500">{t.noData}</p> : (
            <table className="table"><thead><tr><th>RUT</th><th>{t.colParty}</th><th className="text-right">{t.tabCases}</th></tr></thead><tbody>
              {s.byRut.map((r) => (
                <tr key={r.key}><td><Link href={`/quejas?status=open&status=cerrada&q=${encodeURIComponent(r.key)}`} className="badge bg-violet-50 text-violet-700 hover:underline">{r.key}</Link></td><td className="text-sm">{r.name}</td><td className="text-right font-semibold tabular-nums">{r.n}</td></tr>
              ))}
            </tbody></table>
          )}
        </div>
        <div className="card overflow-hidden p-0">
          <h3 className="px-5 pt-5">{t.byHandler}</h3>
          {s.byHandler.length === 0 ? <p className="p-5 text-sm text-slate-500">{t.noData}</p> : (
            <table className="table"><thead><tr><th>{t.fAssigned}</th><th className="text-right">{t.colOpen}</th><th className="text-right">{t.colLate}</th><th className="text-right">{t.colClosed}</th><th className="text-right">{t.colAvg}</th></tr></thead><tbody>
              {s.byHandler.map((h) => (
                <tr key={h.id}><td className="text-sm">{h.name}</td><td className="text-right tabular-nums">{h.open}</td><td className="text-right tabular-nums">{h.late ? <span className="badge bg-red-50 text-mitur-red">✕ {h.late}</span> : 0}</td><td className="text-right tabular-nums">{h.closed}</td><td className="text-right tabular-nums">{fmtN(h.avgDays)}</td></tr>
              ))}
            </tbody></table>
          )}
        </div>
      </div>
    </div>
  );
}
