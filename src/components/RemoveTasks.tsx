"use client";

import { Trash2 } from "lucide-react";
import { useActionState, useEffect, useState, useTransition } from "react";
import type { ActionState } from "@/app/actions";
import type { Dict } from "@/lib/i18n";
import type { RemovalPreview } from "@/lib/remove";
import { ActionForm, SubmitButton } from "./ActionForm";
import { FileField } from "./FileField";

type Selection = { ids?: number[]; filters?: Record<string, string> };
type Remove = (s: ActionState, f: FormData) => Promise<ActionState>;

// Last step, the same from the task list and from a file: counts, reason, type ELIMINAR.
function ConfirmRemoval({ campaignId, selection, p, t, action }: { campaignId: number; selection: Selection; p: RemovalPreview; t: Dict; action: Remove }) {
  if (!p.tasks) return <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{t.removeNone}</p>;
  if (p.tooMany) return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-mitur-red">{t.removeTooMany.replace("{n}", "5000")}</p>;
  return (
    <ActionForm action={action} className="space-y-3">
      <input type="hidden" name="campaignId" value={campaignId} />
      <input type="hidden" name="selection" value={JSON.stringify(selection.filters ? { filters: selection.filters } : { ids: p.ids })} />
      <ul className="list-disc space-y-0.5 pl-5 text-sm text-slate-700" data-testid="removal-summary">
        <li>{t.removeSumTasks.replace("{tasks}", String(p.tasks)).replace("{ests}", String(p.establishments))}</li>
        <li>{t.removeSumCalls.replace("{calls}", String(p.calls)).replace("{visits}", String(p.visits))}</li>
        {p.sigturOpen > 0 && <li className="text-purple-800">{t.removeSumSigtur.replace("{n}", String(p.sigturOpen))}</li>}
        {p.notFound.length > 0 && <li className="text-slate-500">{t.removeSumNotFound.replace("{n}", String(p.notFound.length))}: {p.notFound.slice(0, 10).join(", ")}{p.notFound.length > 10 ? "…" : ""}</li>}
      </ul>
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{t.removeWarning}</p>
      <div>
        <label className="label" htmlFor="remove-reason">{t.removeReason} *</label>
        <input id="remove-reason" name="reason" className="input" required minLength={3} maxLength={200} placeholder={t.removeReasonHint} />
      </div>
      <div>
        <label className="label" htmlFor="remove-confirm">{t.removeTypeConfirm}</label>
        <input id="remove-confirm" name="confirm" className="input" required autoComplete="off" />
      </div>
      <div className="flex justify-end">
        <SubmitButton className="btn-danger"><Trash2 className="h-4 w-4" />{t.removeButtonN.replace("{n}", String(p.tasks))}</SubmitButton>
      </div>
    </ActionForm>
  );
}

// «Tareas y asignación»: the ticked tasks, or all the tasks matching the current filters.
export function RemoveFromList({ campaignId, filters, total, t, preview, action }: {
  campaignId: number; filters: Record<string, string>; total: number; t: Dict;
  preview: (campaignId: number, sel: Selection) => Promise<RemovalPreview | null>; action: Remove;
}) {
  const [ticked, setTicked] = useState<number[]>([]);
  const [mode, setMode] = useState<"ticked" | "filtered">("filtered");
  const [p, setP] = useState<RemovalPreview | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    // The ticked rows of the list (the same checkboxes used to assign).
    const ids = [...document.querySelectorAll<HTMLInputElement>('input[type=checkbox][form="bulk-assign"][name=ids]:checked')].map((c) => Number(c.value));
    setTicked(ids);
    if (ids.length) setMode("ticked");
  }, []);
  const selection: Selection = mode === "filtered" ? { filters } : { ids: ticked };
  const check = () => start(async () => setP(await preview(campaignId, selection)));
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">{t.removeListHelp}</p>
      <div className="space-y-2">
        <label className="choice"><input type="radio" name="remove-mode" checked={mode === "filtered"} onChange={() => { setMode("filtered"); setP(null); }} className="accent-brand-600" /> {t.removeAllFiltered.replace("{n}", String(total))}</label>
        <label className="choice"><input type="radio" name="remove-mode" checked={mode === "ticked"} disabled={!ticked.length} onChange={() => { setMode("ticked"); setP(null); }} className="accent-brand-600" /> {t.removeTicked.replace("{n}", String(ticked.length))}</label>
      </div>
      {!p && (
        <div className="flex justify-end">
          <button type="button" className="btn-secondary" onClick={check} disabled={pending || (mode === "ticked" && !ticked.length)}>{pending ? "…" : t.removeCheck}</button>
        </div>
      )}
      {p && <ConfirmRemoval campaignId={campaignId} selection={selection} p={p} t={t} action={action} />}
    </div>
  );
}

// «Actualizar estatus»: the RUTs (or ID SIGTUR) of a file.
export function RemoveFromFile({ campaignId, t, preview, action }: { campaignId: number; t: Dict; preview: Remove; action: Remove }) {
  const [state, formAction, pending] = useActionState(preview, null);
  const p = (state?.ok ? state.data : null) as RemovalPreview | null;
  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="campaignId" value={campaignId} />
        <FileField label={t.removeFileLabel} required />
        {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-mitur-red" role="alert">{state.error}</p>}
        <div className="flex justify-end"><button className="btn-secondary" disabled={pending}>{pending ? "…" : t.removeCheck}</button></div>
      </form>
      {p && <ConfirmRemoval key={p.ids.join(",")} campaignId={campaignId} selection={{ ids: p.ids }} p={p} t={t} action={action} />}
    </div>
  );
}
