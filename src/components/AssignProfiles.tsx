"use client";

import { useState } from "react";
import type { ActionState } from "@/app/actions";
import { ActionForm } from "./ActionForm";
import { Avatar } from "./Avatar";

type Person = { id: number; name: string; username: string; active: boolean; profileId: number | null; self: boolean };

// «Permisos → Personas y perfiles»: one profile per person; «Guardar» is available once something changed.
export function AssignProfiles({ people, profiles, modulesOf, t, action }: {
  people: Person[]; profiles: { id: number; name: string }[]; modulesOf: Record<number, string>;
  t: { name: string; profile: string; modules: string; save: string; hint: string; you: string; inactive: string; none: string }; action: (s: ActionState, f: FormData) => Promise<ActionState>;
}) {
  const [values, setValues] = useState<Record<number, string>>(() => Object.fromEntries(people.map((p) => [p.id, String(p.profileId ?? "")])));
  const changed = people.some((p) => values[p.id] !== String(p.profileId ?? ""));
  return (
    <ActionForm action={action} className="card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="table" data-testid="assign-profiles">
          <thead><tr><th>{t.name}</th><th>{t.profile}</th><th>{t.modules}</th></tr></thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id} className={p.active ? "" : "opacity-50"}>
                <td className="min-w-[13rem]">
                  <div className="flex items-center gap-3">
                    <Avatar name={p.name} size="sm" />
                    <div>
                      <div className="font-medium text-slate-900">{p.name}{p.self && <span className="ml-2 text-xs font-normal text-slate-400">({t.you})</span>}</div>
                      <div className="text-xs text-slate-500">{p.username}{!p.active && ` · ${t.inactive}`}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <select name={p.self ? undefined : `profile-${p.id}`} value={values[p.id]} disabled={p.self} onChange={(e) => setValues({ ...values, [p.id]: e.target.value })} className="input w-60 py-1.5" aria-label={`${p.name}: ${t.profile}`}>
                    {!p.profileId && <option value="">—</option>}
                    {profiles.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                </td>
                <td className="text-sm text-slate-500">{modulesOf[Number(values[p.id])] || t.none}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
        <p className="text-xs text-slate-500">{t.hint}</p>
        <button className="btn" disabled={!changed}>{t.save}</button>
      </div>
    </ActionForm>
  );
}
