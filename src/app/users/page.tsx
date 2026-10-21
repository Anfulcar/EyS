import { asc, gte } from "drizzle-orm";
import { CalendarOff, Pencil, Plus } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Avatar } from "@/components/Avatar";
import { Overlay } from "@/components/Overlay";
import { StatusBadge } from "@/components/ui";
import { db } from "@/db";
import { absences, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ABSENCE_LABELS, label, ROLES } from "@/lib/catalog";
import { fmtDate, todayLocal } from "@/lib/dates";
import { getDict } from "@/lib/i18n-server";
import { addAbsenceAction, createUserAction, deleteAbsenceAction, editUserAction } from "../actions";

export default async function UsersPage() {
  const me = await requireUser(["admin"]);
  const { t, lang } = await getDict();
  const today = todayLocal();
  const [list, abs] = await Promise.all([
    db.select().from(users).orderBy(asc(users.name)),
    db.select().from(absences).where(gte(absences.toDate, today)).orderBy(asc(absences.fromDate)),
  ]);
  const absBy = new Map<number, typeof abs>();
  for (const a of abs) absBy.set(a.userId, [...(absBy.get(a.userId) ?? []), a]);
  const roleOptions = Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v[lang]}</option>);
  return (
    <div className="space-y-6">
      <div className="page-title">
        <h1>{t.navUsers}</h1>
        <Overlay trigger={<><Plus className="h-4 w-4" />{t.newUser}</>} title={t.newUser} width="max-w-lg">
          <ActionForm action={createUserAction} className="space-y-4" resetOnSuccess>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">{t.username}</label>
                <input name="username" className="input" required pattern="[a-zA-Z0-9._\-]{3,40}" placeholder="ana" />
              </div>
              <div>
                <label className="label">{t.name}</label>
                <input name="name" className="input" required placeholder="Ana Pérez" />
              </div>
              <div>
                <label className="label">{t.role}</label>
                <select name="role" className="input" defaultValue="agent">{roleOptions}</select>
              </div>
              <div>
                <label className="label">{t.passwordOptional}</label>
                <input name="password" className="input" placeholder="ana123" />
              </div>
            </div>
            <p className="text-xs text-slate-500">{t.defaultPasswordHint}</p>
            <div className="flex justify-end"><SubmitButton>{t.create}</SubmitButton></div>
          </ActionForm>
        </Overlay>
      </div>

      <div className="card overflow-hidden p-0">
        <table className="table">
          <thead>
            <tr><th>{t.name}</th><th>{t.role}</th><th>{t.status}</th><th className="text-right">{t.actions}</th></tr>
          </thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id} className={u.active ? "" : "opacity-60"}>
                <td>
                  <div className="flex items-center gap-3">
                    <Avatar name={u.name} size="sm" />
                    <div>
                      <div className="font-medium text-slate-900">{u.name}{u.id === me.id && <span className="ml-2 text-xs font-normal text-slate-400">({lang === "es" ? "usted" : "you"})</span>}</div>
                      <div className="font-mono text-xs text-slate-500">{u.username}</div>
                    </div>
                  </div>
                </td>
                <td className="text-slate-700">{ROLES[u.role]?.[lang] ?? u.role}</td>
                <td>
                  <StatusBadge status={u.active ? "active" : "closed"} label={u.active ? t.active : t.inactive} />
                  {absBy.get(u.id)?.slice(0, 1).map((a) => (
                    <div key={a.id} className={`mt-1 text-xs ${a.fromDate <= today ? "font-medium text-amber-700" : "text-slate-500"}`}>
                      {a.fromDate <= today ? t.absentTag : label(ABSENCE_LABELS, a.kind, lang)} · {fmtDate(a.fromDate, lang)} – {fmtDate(a.toDate, lang)}
                    </div>
                  ))}
                </td>
                <td className="space-x-2 whitespace-nowrap text-right">
                  <Overlay key={`abs-${u.id}`} trigger={<><CalendarOff className="h-3.5 w-3.5" />{t.absences}</>} triggerClassName="btn-secondary btn-sm" title={`${t.absences}: ${u.name}`} width="max-w-lg">
                    <div className="space-y-5 text-left">
                      {(absBy.get(u.id) ?? []).length === 0 ? (
                        <p className="text-sm text-slate-500">{t.noAbsences}</p>
                      ) : (
                        <ul className="space-y-2">
                          {absBy.get(u.id)!.map((a) => (
                            <li key={a.id} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                              <span className="flex-1">
                                <b>{label(ABSENCE_LABELS, a.kind, lang)}</b> · {fmtDate(a.fromDate, lang)} – {fmtDate(a.toDate, lang)}
                                {a.note && <span className="block text-xs text-slate-500">{a.note}</span>}
                              </span>
                              <ActionForm action={deleteAbsenceAction}>
                                <input type="hidden" name="absenceId" value={a.id} />
                                <SubmitButton className="btn-secondary btn-sm">{t.delete}</SubmitButton>
                              </ActionForm>
                            </li>
                          ))}
                        </ul>
                      )}
                      <ActionForm action={addAbsenceAction} className="space-y-3 border-t border-slate-100 pt-4">
                        <input type="hidden" name="userId" value={u.id} />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div><label className="label">{t.from}</label><input type="date" name="fromDate" required className="input" defaultValue={today} /></div>
                          <div><label className="label">{t.to}</label><input type="date" name="toDate" required className="input" defaultValue={today} /></div>
                        </div>
                        <div>
                          <label className="label">{t.absenceKind}</label>
                          <select name="kind" className="input" defaultValue="vacation">
                            {Object.entries(ABSENCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v[lang]}</option>)}
                          </select>
                        </div>
                        <div><label className="label">{t.notes}</label><input name="note" className="input" maxLength={200} /></div>
                        <div className="flex justify-end"><SubmitButton>{t.addAbsence}</SubmitButton></div>
                      </ActionForm>
                    </div>
                  </Overlay>
                  <Overlay key={`${u.username}|${u.name}|${u.role}|${u.active}`} trigger={<><Pencil className="h-3.5 w-3.5" />{t.edit}</>} triggerClassName="btn-secondary btn-sm" title={`${t.editUserTitle}: ${u.name}`} width="max-w-lg">
                    <ActionForm action={editUserAction} className="space-y-4 text-left">
                      <input type="hidden" name="id" value={u.id} />
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="label">{t.username}</label>
                          <input name="username" className="input" defaultValue={u.username} required pattern="[a-zA-Z0-9._\-]{3,40}" />
                        </div>
                        <div>
                          <label className="label">{t.name}</label>
                          <input name="name" className="input" defaultValue={u.name} required />
                        </div>
                        <div>
                          <label className="label">{t.role}</label>
                          <select name="role" className="input" defaultValue={u.role} disabled={u.id === me.id}>{roleOptions}</select>
                          {u.id === me.id && <input type="hidden" name="role" value={u.role} />}
                        </div>
                        <div>
                          <label className="label">{t.status}</label>
                          <select name="active" className="input" defaultValue={u.active ? "1" : "0"} disabled={u.id === me.id}>
                            <option value="1">{t.active}</option>
                            <option value="0">{t.inactive}</option>
                          </select>
                          {u.id === me.id && <input type="hidden" name="active" value="1" />}
                        </div>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-4">
                        <label className="label">{t.newPasswordOptional}</label>
                        <input name="password" className="input" autoComplete="new-password" />
                        <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" name="resetDefault" value="1" className="h-4 w-4 accent-brand-600" /> {t.resetToDefault}</label>
                      </div>
                      <div className="flex justify-end"><SubmitButton>{t.save}</SubmitButton></div>
                    </ActionForm>
                  </Overlay>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
