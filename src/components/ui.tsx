import { Inbox, Send } from "lucide-react";
import type { Dict } from "@/lib/i18n";

export function Kpi({ label, value, sub, target, pct }: { label: string; value: string | number; sub?: string; target?: string; pct?: number }) {
  const met = pct != null && target != null ? pct >= parseFloat(target.replace(/[^\d.]/g, "")) : null;
  return (
    <div className="card p-4">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1.5 text-2xl font-bold tabular-nums text-slate-900">{value}</div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        {sub && <span>{sub}</span>}
        {target && (
          <span className={`badge ${met == null ? "bg-slate-100 text-slate-600" : met ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{target}</span>
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

const STATUS_COLORS: Record<string, [string, string]> = {
  pending: ["bg-slate-100 text-slate-700", "bg-slate-400"],
  retry: ["bg-amber-50 text-amber-800", "bg-mitur-yellow"],
  followup: ["bg-brand-50 text-brand-700", "bg-brand-600"],
  visit: ["bg-orange-50 text-orange-800", "bg-mitur-orange"],
  done: ["bg-emerald-50 text-emerald-800", "bg-mitur-green"],
  transferred: ["bg-violet-50 text-violet-700", "bg-violet-400"],
  draft: ["bg-slate-100 text-slate-700", "bg-slate-400"],
  active: ["bg-emerald-50 text-emerald-800", "bg-mitur-green"],
  closed: ["bg-slate-100 text-slate-500", "bg-slate-300"],
}

export function StatusBadge({ status, label }: { status: string; label: string }) {
  const [c, dot] = STATUS_COLORS[status] ?? STATUS_COLORS.pending;
  return (
    <span className={`badge ${c}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

export function PriorityBadge({ p }: { p: string | null }) {
  if (!p) return null;
  const c = p === "P1" ? "bg-red-50 text-mitur-red ring-red-200" : p === "P2" ? "bg-orange-50 text-orange-700 ring-orange-200" : "bg-slate-50 text-slate-600 ring-slate-200";
  return <span className={`badge ring-1 ring-inset ${c}`}>{p}</span>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-14 text-center text-sm text-slate-500">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Inbox className="h-6 w-6" /></span>
      {children}
    </div>
  );
}

export function SectionTitle({ icon, children, action }: { icon?: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2.5">
        {icon && <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">{icon}</span>}
        {children}
      </h2>
      {action}
    </div>
  );
}

// Purple tag for calls requested from SIGTUR, with who asked and why.
export function SigturTag({ by, reason, t }: { by: string | null; reason: string | null; t: Dict }) {
  const who = by ? t.sigturRequestBy.replace("{who}", by) : "";
  return (
    <span className="badge bg-purple-600 text-white" title={[who, reason].filter(Boolean).join(": ")}>
      <Send className="h-3 w-3" />{t.sigturTag}
    </span>
  );
}

export function SigturRequestNote({ by, reason, t }: { by: string | null; reason: string | null; t: Dict }) {
  return (
    <p className="flex flex-wrap items-center gap-2 rounded-xl bg-purple-50 px-4 py-3 text-sm text-purple-900">
      <SigturTag by={by} reason={reason} t={t} />
      {by && <span className="font-medium">{t.sigturRequestBy.replace("{who}", by)}</span>}
      {reason && <span>· {reason}</span>}
    </p>
  );
}
