import { CheckCircle2, Circle, MessageSquare } from "lucide-react";
import Link from "next/link";
import { CODE_SHORT, codeLabel, codeTone, label, type Lang } from "@/lib/catalog";
import { fmtDateTime } from "@/lib/dates";
import type { Dict } from "@/lib/i18n";
import type { callRows } from "@/lib/reviews";

const TONES = { good: "bg-emerald-50 text-emerald-800", info: "bg-brand-50 text-brand-700", warn: "bg-amber-50 text-amber-800", bad: "bg-red-50 text-mitur-red", none: "bg-slate-100 text-slate-600" };
type Row = Awaited<ReturnType<typeof callRows>>[number];

// The list of «Llamadas realizadas» (also in «Resumen del agente»): each date opens the call summary.
export function CallsTable({ rows, t, lang, showAgent, pager }: { rows: Row[]; t: Dict; lang: Lang; showAgent: boolean; pager?: React.ReactNode }) {
  return (
    <div className="card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>{t.calledAtCol}</th>
              {showAgent && <th>{t.agent}</th>}
              <th>{t.company}</th>
              <th>{t.phoneNumber}</th>
              <th>{t.result}</th>
              <th>{t.reviewState}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.a.id}>
                <td className="whitespace-nowrap">
                  <Link href={`/reviews/${r.a.id}`} className="font-medium text-brand-700 hover:underline">{fmtDateTime(r.a.calledAt, lang)}</Link>
                </td>
                {showAgent && <td className="whitespace-nowrap">{r.agent}</td>}
                <td className="min-w-[14rem]">
                  <div className="font-medium text-slate-900">{r.name}</div>
                  <div className="text-xs text-slate-500">{r.rut ? `RUT ${r.rut} · ` : ""}{r.campaign}</div>
                </td>
                <td className="whitespace-nowrap font-mono text-sm">{r.a.phoneNumber ?? "—"}</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {r.codes.map((c) => <span key={c} className={`badge ${TONES[codeTone(c)]}`} title={codeLabel(c, lang)}>{label(CODE_SHORT, c, lang)}</span>)}
                  </div>
                </td>
                <td className="whitespace-nowrap">
                  {r.a.reviewedAt ? (
                    <span className="inline-flex items-center gap-1 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />{t.reviewed}{r.a.reviewComment && <MessageSquare className="h-3.5 w-3.5" aria-label={t.reviewCommentLabel} />}</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-sm text-slate-400"><Circle className="h-4 w-4" />{t.notReviewed}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pager}
    </div>
  );
}
