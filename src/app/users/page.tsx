import { asc } from "drizzle-orm";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { StatusBadge } from "@/components/ui";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ROLES } from "@/lib/catalog";
import { fmtDate } from "@/lib/dates";
import { getDict } from "@/lib/i18n-server";
import { createUserAction, editUserAction } from "../actions";

export default async function UsersPage() {
  const me = await requireUser(["admin"]);
  const { t, lang } = await getDict();
  const list = await db.select().from(users).orderBy(asc(users.name));
  const roleOptions = Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v[lang]}</option>);
  return (
    <div className="space-y-6">
      <h1>{t.navUsers}</h1>
      <ActionForm action={createUserAction} className="card" resetOnSuccess>
        <h2 className="mb-4">{t.newUser}</h2>
        <div className="grid gap-4 md:grid-cols-5">
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
          <div className="flex items-end"><SubmitButton>{t.create}</SubmitButton></div>
        </div>
        <p className="mt-2 text-xs text-slate-500">{t.defaultPasswordHint}</p>
      </ActionForm>

      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr><th>{t.username}</th><th>{t.name}</th><th>{t.role}</th><th>{t.status}</th><th>{t.date}</th><th></th></tr>
          </thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id} className={u.active ? "" : "opacity-60"}>
                <td className="font-mono text-xs">{u.username}</td>
                <td>{u.name}</td>
                <td>{ROLES[u.role]?.[lang] ?? u.role}</td>
                <td><StatusBadge status={u.active ? "active" : "closed"} label={u.active ? t.active : t.inactive} /></td>
                <td className="text-xs text-slate-500">{fmtDate(u.createdAt, lang)}</td>
                <td className="w-[28rem]">
                  <details key={`${u.username}|${u.name}|${u.role}|${u.active}`}>
                    <summary className="btn-secondary btn-sm cursor-pointer list-none">{t.edit}</summary>
                    <ActionForm action={editUserAction} className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <input type="hidden" name="id" value={u.id} />
                      <div className="grid grid-cols-2 gap-3">
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
                      <div>
                        <label className="label">{t.newPasswordOptional}</label>
                        <input name="password" className="input" autoComplete="new-password" />
                      </div>
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="resetDefault" value="1" /> {t.resetToDefault}</label>
                      <SubmitButton>{t.save}</SubmitButton>
                    </ActionForm>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
