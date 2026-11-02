"use client";

import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { ActionState } from "@/app/actions";
import { ActionForm, ConfirmButton, SubmitButton } from "./ActionForm";
import { Avatar } from "./Avatar";
import { ConfirmDialog } from "./ConfirmDialog";
import { toast } from "./Toasts";
import { withoutDependents, withRequirements } from "@/lib/permissions-core.mjs";
import { menuFor, type MenuLabels } from "@/lib/permissions-text";

type Act = { id: string; label: string; help: string; req: string[]; adminOnly?: boolean };
type Mod = { id: string; title: string; actions: Act[] };
type Profile = { id: number; name: string; description: string; actions: string[]; isAdmin: boolean; people: string[] };
type Action = (s: ActionState, f: FormData) => Promise<ActionState>;
export type ProfilesText = Record<
  "permActionsOf" | "permNew" | "permName" | "permDesc" | "permLocked" | "permMarkAll" | "permClearAll" | "permNeeds" | "permAdminOnly" | "permMenuPreview" |
  "permPeopleWith" | "permNobody" | "permDuplicate" | "permDeleteHint" | "permDeleteConfirm" | "permDiscard" | "permAffectsOne" | "permAffectsMany" |
  "permAlsoTicked" | "permAlsoUnticked" | "permUnsaved" | "permPasswordNote" | "delete" | "save" | "discardConfirm",
  string
>;

const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");

// «Permisos → Perfiles»: the list of profiles and the checklist of the open one, with the menu it gives and the people who have it.
export function ProfilesView({ profiles, selected, modules, total, menuLabels, groups, t, save, create, remove }: {
  profiles: Profile[]; selected: number; modules: Mod[]; total: number; menuLabels: MenuLabels; groups: { calls: string; qr: string; general: string };
  t: ProfilesText; save: Action; create: Action; remove: Action;
}) {
  const p = profiles.find((x) => x.id === selected) ?? profiles[0];
  const router = useRouter();
  const [name, setName] = useState(p.name);
  const [desc, setDesc] = useState(p.description);
  const [acts, setActs] = useState<string[]>(p.actions);
  const [leaving, setLeaving] = useState<null | (() => void)>(null);
  const labelOf = useMemo(() => new Map(modules.flatMap((m) => m.actions.map((a) => [a.id, a.label] as const))), [modules]);
  const dirty = !p.isAdmin && (name !== p.name || desc !== p.description || !same(acts, p.actions));
  const n = p.people.length;

  const toggle = (id: string, on: boolean) => {
    const next = on ? withRequirements([...acts, id]) : withoutDependents(acts, id);
    const added = next.filter((x) => !acts.includes(x) && x !== id);
    const removed = acts.filter((x) => !next.includes(x) && x !== id);
    if (added.length) toast(t.permAlsoTicked.replace("{list}", added.map((x) => labelOf.get(x)).join(", ")));
    if (removed.length) toast(t.permAlsoUnticked.replace("{list}", removed.map((x) => labelOf.get(x)).join(", ")));
    setActs(next);
  };
  const bulk = (m: Mod, on: boolean) => {
    let next = acts;
    for (const a of m.actions) if (!a.adminOnly) next = on ? withRequirements([...next, a.id]) : withoutDependents(next, a.id);
    setActs(next);
  };
  // Leaving a profile with unsaved changes asks first.
  const go = (fn: () => void) => (dirty ? setLeaving(() => fn) : fn());

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]" data-testid="profiles">
      <div className="card space-y-1.5 p-2.5">
        {profiles.map((x) => (
          <button key={x.id} type="button" onClick={() => x.id !== p.id && go(() => router.push(`/admin/permissions?p=${x.id}`))}
            aria-current={x.id === p.id ? "true" : undefined}
            className={`grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-2 rounded-xl border px-3 py-2.5 text-left transition ${x.id === p.id ? "border-brand-500 bg-brand-50" : "border-transparent hover:bg-slate-50"}`}>
            <b className="flex min-w-0 items-center gap-1.5 truncate text-sm text-slate-900">{x.name}{x.isAdmin && <Lock className="h-3.5 w-3.5 flex-none text-slate-400" aria-hidden />}</b>
            <span className="badge bg-slate-100 text-slate-600">{x.people.length}</span>
            <span className="col-span-2 text-xs text-slate-500">
              {t.permActionsOf.replace("{n}", String(x.id === p.id ? acts.length : x.actions.length)).replace("{t}", String(total))}
              {x.id === p.id && dirty && <b className="text-amber-700"> · {t.permUnsaved}</b>}
            </span>
          </button>
        ))}
        <div className="border-t border-slate-100 pt-2">
          <ActionForm action={create}>
            {dirty
              ? <ConfirmButton message={t.discardConfirm} className="btn-secondary btn-sm w-full" confirmLabel={t.permDiscard}>+ {t.permNew}</ConfirmButton>
              : <SubmitButton className="btn-secondary btn-sm w-full">+ {t.permNew}</SubmitButton>}
          </ActionForm>
        </div>
      </div>

      <div className="card space-y-4">
        {p.isAdmin && <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900"><Lock className="mt-0.5 h-4 w-4 flex-none" />{t.permLocked}</p>}
        <ActionForm action={save} id="profile-form" className="space-y-4">
          <input type="hidden" name="profileId" value={p.id} />
          {acts.map((a) => <input key={a} type="hidden" name="actions" value={a} />)}
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label" htmlFor="pname">{t.permName}</label><input id="pname" name="name" className="input" value={name} onChange={(e) => setName(e.target.value)} disabled={p.isAdmin} maxLength={60} required /></div>
            <div><label className="label" htmlFor="pdesc">{t.permDesc}</label><input id="pdesc" name="description" className="input" value={desc} onChange={(e) => setDesc(e.target.value)} disabled={p.isAdmin} maxLength={300} /></div>
          </div>
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_14rem]">
            <div className="space-y-3">
              {modules.map((m) => {
                const on = m.actions.filter((a) => acts.includes(a.id)).length;
                return (
                  <section key={m.id} className="overflow-hidden rounded-xl border border-slate-200" data-testid={`module-${m.id}`}>
                    <header className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-4 py-2.5">
                      <h3 className="flex items-center gap-2">{m.title} <span className={`badge ${on ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-500"}`}>{on} / {m.actions.length}</span></h3>
                      {!p.isAdmin && (
                        <span className="flex gap-3 text-xs font-semibold">
                          <button type="button" className="text-brand-700 hover:underline" onClick={() => bulk(m, true)}>{t.permMarkAll}</button>
                          <button type="button" className="text-brand-700 hover:underline" onClick={() => bulk(m, false)}>{t.permClearAll}</button>
                        </span>
                      )}
                    </header>
                    <div className="grid sm:grid-cols-2">
                      {m.actions.map((a) => {
                        const locked = p.isAdmin || !!a.adminOnly;
                        return (
                          <label key={a.id} className={`grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2.5 border-t border-slate-100 px-4 py-2.5 text-sm ${locked ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:bg-slate-50"}`}>
                            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-600" checked={acts.includes(a.id)} disabled={locked} onChange={(e) => toggle(a.id, e.target.checked)} data-action={a.id} />
                            <span className="text-slate-900">{a.label}</span>
                            {a.help && <span className="col-start-2 text-xs text-slate-500">{a.help}</span>}
                            {a.adminOnly && !p.isAdmin && <span className="col-start-2 text-xs text-violet-700">{t.permAdminOnly}</span>}
                            {a.req.length > 0 && <span className="col-start-2 text-xs text-violet-700">{t.permNeeds.replace("{list}", a.req.map((r) => labelOf.get(r)).join(", "))}</span>}
                          </label>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
            <aside className="space-y-4 xl:sticky xl:top-4">
              <div>
                <div className="label">{t.permMenuPreview}</div>
                <div className="space-y-0.5 rounded-xl bg-slate-50 p-2.5 text-sm" data-testid="menu-preview">
                  {menuFor(acts, menuLabels, groups).map(([g, items]) => (
                    <div key={g}>
                      <div className="px-1.5 pb-0.5 pt-2 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">{g}</div>
                      {items.map((i) => <div key={i} className="mb-0.5 rounded-md bg-white px-2 py-1">{i}</div>)}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="label">{t.permPeopleWith.replace("{n}", String(n))}</div>
                {n ? (
                  <div className="flex flex-wrap gap-1.5">{p.people.map((x) => <span key={x} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-0.5 pl-0.5 pr-2.5 text-xs font-medium"><Avatar name={x} size="sm" />{x}</span>)}</div>
                ) : <p className="text-xs text-slate-500">{t.permNobody}</p>}
              </div>
            </aside>
          </div>
        </ActionForm>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <ActionForm action={create}>
              <input type="hidden" name="fromId" value={p.id} />
              {dirty ? <ConfirmButton message={t.discardConfirm} className="btn-secondary" confirmLabel={t.permDiscard}>{t.permDuplicate}</ConfirmButton> : <SubmitButton className="btn-secondary">{t.permDuplicate}</SubmitButton>}
            </ActionForm>
            {!p.isAdmin && (
              n ? (
                <><button type="button" className="btn-secondary" disabled title={t.permDeleteHint}>{t.delete}</button><span className="text-xs text-slate-500">{t.permDeleteHint}</span></>
              ) : (
                <ActionForm action={remove}>
                  <input type="hidden" name="profileId" value={p.id} />
                  <ConfirmButton message={t.permDeleteConfirm.replace("{p}", p.name)} className="btn-secondary text-rose-700" danger>{t.delete}</ConfirmButton>
                </ActionForm>
              )
            )}
          </div>
          {!p.isAdmin && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500">{t.permPasswordNote}</span>
              {dirty && <button type="button" className="btn-secondary" onClick={() => { setName(p.name); setDesc(p.description); setActs(p.actions); }}>{t.permDiscard}</button>}
              <button type="submit" form="profile-form" className="btn" disabled={!dirty}>{n === 0 ? t.save : n === 1 ? t.permAffectsOne : t.permAffectsMany.replace("{n}", String(n))}</button>
            </div>
          )}
        </div>
      </div>
      {leaving && <ConfirmDialog message={t.discardConfirm} confirmLabel={t.permDiscard} onCancel={() => setLeaving(null)} onConfirm={() => { const fn = leaving; setLeaving(null); fn(); }} />}
    </div>
  );
}
