export function Kpi({ label, value, sub, target, pct }: { label: string; value: string | number; sub?: string; target?: string; pct?: number }) {
  const met = pct != null && target != null ? pct >= parseFloat(target) : null;
  return (
    <div className="card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        {sub && <span>{sub}</span>}
        {target && (
          <span className={`badge ${met == null ? "bg-slate-100 text-slate-600" : met ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
            {target}
          </span>
        )}
      </div>
    </div>
  );
}

export function pct(n: number, d: number) {
  return d ? Math.round((n / d) * 1000) / 10 : 0;
}

export function fmtPct(n: number, d: number) {
  return d ? `${pct(n, d).toLocaleString()} %` : "—";
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-slate-100 text-slate-700",
  retry: "bg-amber-50 text-amber-700",
  followup: "bg-sky-50 text-sky-700",
  visit: "bg-violet-50 text-violet-700",
  done: "bg-emerald-50 text-emerald-700",
  draft: "bg-slate-100 text-slate-700",
  active: "bg-emerald-50 text-emerald-700",
  closed: "bg-slate-200 text-slate-600",
};

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return <span className={`badge ${STATUS_COLORS[status] ?? "bg-slate-100 text-slate-700"}`}>{label}</span>;
}

export function PriorityBadge({ p }: { p: string | null }) {
  if (!p) return null;
  const c = p === "P1" ? "bg-red-50 text-red-700" : p === "P2" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600";
  return <span className={`badge ${c}`}>{p}</span>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">{children}</div>;
}
