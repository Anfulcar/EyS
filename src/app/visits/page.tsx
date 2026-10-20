import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Empty, PriorityBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { codeLabel, VISIT_CODES } from "@/lib/catalog";
import { fmtDate, todayLocal } from "@/lib/dates";
import { getDict } from "@/lib/i18n-server";
import { pendingVisits } from "@/lib/visits";
import { logVisitAction } from "../actions";

export default async function VisitsPage({ searchParams }: { searchParams: Promise<{ campaign?: string; zone?: string; all?: string }> }) {
  await requireUser(["admin", "supervisor", "inspector"]);
  const sp = await searchParams;
  const { t, lang } = await getDict();
  const { rows, active, zones } = await pendingVisits({ campaignId: sp.campaign ? Number(sp.campaign) : undefined, zone: sp.zone, showAll: sp.all === "1" });
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString();
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1>{t.visitsTitle} <span className="text-base font-normal text-slate-500">({rows.length})</span></h1>
        <a href={`/api/visits?${qs}`} className="btn-secondary">⬇ {t.downloadRoute}</a>
      </div>
      <form className="card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label">{t.campaign}</label>
          <select name="campaign" defaultValue={sp.campaign ?? ""} className="input w-64">
            <option value="">{t.all}</option>
            {active.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{t.zone}</label>
          <select name="zone" defaultValue={sp.zone ?? ""} className="input w-72">
            <option value="">{t.all}</option>
            {zones.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="all" value="1" defaultChecked={sp.all === "1"} /> {t.visitsDone}</label>
        <button className="btn-secondary">{t.filter}</button>
      </form>
      {rows.length === 0 ? (
        <Empty>{t.noVisits}</Empty>
      ) : (
        <div className="space-y-2">
          {rows.map(({ e, visits, phones }) => (
            <div key={e.id} className="card p-4">
              <div className="flex flex-wrap items-start gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><PriorityBadge p={e.prioridad} /><span className="font-semibold">{e.nombreComercial}</span><span className="text-xs text-slate-500">{e.razonSocial} · ID {e.sigturId}</span></div>
                  <div className="mt-1 text-sm text-slate-700">{e.direccion}</div>
                  <div className="text-xs text-slate-500">{e.municipio} · {e.zonaOperativa} · {e.estatusRnt}{e.fechaVencimiento ? ` (${fmtDate(e.fechaVencimiento, lang)})` : ""}</div>
                  <div className="font-mono text-xs text-slate-500">{phones.join(" / ")}</div>
                  {e.finalCode && <div className="mt-1 text-xs">{codeLabel(e.finalCode, lang)}</div>}
                  {visits.map((v) => <div key={v.id} className="text-xs text-violet-700">{t.visitNo} {v.visitNo} · {fmtDate(v.visitDate, lang)} · {codeLabel(v.code, lang)}</div>)}
                </div>
                <details className="w-full md:w-96">
                  <summary className="btn btn-sm cursor-pointer list-none">{t.registerVisit}</summary>
                  <ActionForm action={logVisitAction} className="mt-3 space-y-3" resetOnSuccess>
                    <input type="hidden" name="establishmentId" value={e.id} />
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="label">{t.visitDate}</label><input type="date" name="visitDate" className="input" defaultValue={todayLocal()} required /></div>
                      <div><label className="label">{t.qCommitment}</label><input type="date" name="commitmentDate" className="input" /></div>
                    </div>
                    <div>
                      <label className="label">{t.visitResult}</label>
                      <select name="code" className="input" required defaultValue="">
                        <option value="" disabled>—</option>
                        {Object.entries(VISIT_CODES).map(([k, v]) => <option key={k} value={k}>{k} {v[lang]}</option>)}
                      </select>
                    </div>
                    <div><label className="label">{t.notes}</label><textarea name="notes" className="input" rows={2} /></div>
                    <SubmitButton>{t.save}</SubmitButton>
                  </ActionForm>
                </details>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
