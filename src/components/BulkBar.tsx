"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import type { ActionState } from "@/app/actions";
import { ActionForm, SubmitButton } from "./ActionForm";

const TICKED = 'input[type=checkbox][form="bulk-assign"][name=ids]';

// «Tareas y asignación»: a bar at the bottom of the screen, only while rows are ticked.
// It holds the same «Asignar seleccionadas a» form as before (the row checkboxes belong to it).
export function BulkBar({ campaignId, agents, action, removeTriggerId, t }: {
  campaignId: number; agents: { id: number; name: string }[]; action: (s: ActionState, f: FormData) => Promise<ActionState>;
  removeTriggerId?: string; t: { markedN: string; assignSelected: string; unassigned: string; apply: string; removeEllipsis: string; unmarkAll: string };
}) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const count = () => setN(document.querySelectorAll(`${TICKED}:checked`).length);
    // A reset (after assigning) changes the boxes without a change event.
    const later = () => setTimeout(count, 0);
    document.addEventListener("change", count);
    document.addEventListener("reset", later, true);
    count();
    return () => { document.removeEventListener("change", count); document.removeEventListener("reset", later, true); };
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("has-bulkbar", n > 0);
    return () => document.documentElement.classList.remove("has-bulkbar");
  }, [n]);
  const untick = () => {
    document.querySelectorAll<HTMLInputElement>(TICKED).forEach((c) => (c.checked = false));
    document.querySelectorAll<HTMLInputElement>("input[data-select-all]").forEach((c) => (c.checked = false));
    setN(0);
  };
  return (
    <div
      role="region"
      aria-label={t.markedN.replace("{n}", String(n))}
      hidden={n === 0}
      className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30 mx-auto w-fit max-w-[calc(100vw-2rem)] rounded-2xl bg-slate-900 px-4 py-2.5 text-white shadow-2xl"
    >
      <ActionForm id="bulk-assign" action={action} resetOnSuccess className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <input type="hidden" name="campaignId" value={campaignId} />
        <b data-testid="bulk-count">{t.markedN.replace("{n}", String(n))}</b>
        <span className="h-5 w-px bg-white/25" />
        <label htmlFor="bulk-agent">{t.assignSelected}</label>
        <select id="bulk-agent" name="userId" className="input w-44 py-1.5 text-slate-800">
          <option value="">{t.unassigned}</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <SubmitButton className="btn-secondary btn-sm">{t.apply}</SubmitButton>
        {removeTriggerId && (
          <>
            <span className="h-5 w-px bg-white/25" />
            <button type="button" className="font-semibold text-rose-300 hover:text-rose-200" onClick={() => document.getElementById(removeTriggerId)?.click()}>{t.removeEllipsis}</button>
          </>
        )}
        <button type="button" onClick={untick} aria-label={t.unmarkAll} title={t.unmarkAll} className="rounded-lg p-1 text-white/70 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
      </ActionForm>
    </div>
  );
}
