import { ArrowLeft, Download } from "lucide-react";
import Link from "next/link";
import { codeLabel, COMPANY_STATUSES, label, type Lang } from "@/lib/catalog";
import type { Dict } from "@/lib/i18n";
import type { drillDown } from "@/lib/stats";
import { Avatar } from "./Avatar";
import { Empty, PriorityBadge, StatusBadge } from "./ui";

type Rows = Awaited<ReturnType<typeof drillDown>>;
const SHOWN = 500;

export function DrillList({ title, rows, backHref, backLabel, downloadHref, t, lang }: { title: string; rows: Rows; backHref: string; backLabel: string; downloadHref: string; t: Dict; lang: Lang }) {
  return (
    <div className="space-y-5">
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" />{backLabel}</Link>
      <div className="page-title">
        <div>
          <h1>{title}</h1>
          <p className="subtitle">{rows.length} {t.establishments.toLowerCase()}</p>
        </div>
        {rows.length > 0 && <a href={downloadHref} className="btn-secondary"><Download className="h-4 w-4" />{t.download} (Excel)</a>}
      </div>
      {rows.length === 0 ? (
        <Empty>{t.noData}</Empty>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>{t.company}</th><th>{t.zone}</th><th>{t.byStatus}</th><th>{t.lastResult}</th><th>{t.status}</th><th>{t.assignedTo}</th></tr>
              </thead>
              <tbody>
                {rows.slice(0, SHOWN).map(({ e, task, agent }) => (
                  <tr key={e.id}>
                    <td className="min-w-[16rem]">
                      <div className="flex items-center gap-3">
                        <Avatar name={e.nombreComercial ?? e.sigturId} size="sm" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Link href={`/calls/${e.companyId}`} className="truncate font-medium text-slate-900 hover:text-brand-700">{e.nombreComercial}</Link>
                            <PriorityBadge p={e.prioridad} />
                          </div>
                          <div className="truncate text-xs text-slate-500">RUT {e.rut} · RNC {e.rnc} · {e.municipio}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-xs" title={e.zonaOperativa ?? ""}>{e.zonaOperativa?.split(".")[0] ?? "—"}</td>
                    <td className="whitespace-nowrap text-xs">{e.estatusSigturActualizado ?? e.estatusRnt}</td>
                    <td className="text-xs">{codeLabel(e.finalCode, lang) || "—"}</td>
                    <td className="whitespace-nowrap">{task && <StatusBadge status={task.status} label={label(COMPANY_STATUSES, task.status, lang)} />}</td>
                    <td className="whitespace-nowrap text-xs">{agent ?? t.unassigned}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > SHOWN && <p className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500">{SHOWN} / {rows.length} — {t.download} (Excel)</p>}
        </div>
      )}
    </div>
  );
}
