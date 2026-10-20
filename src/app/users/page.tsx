import { asc } from "drizzle-orm";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ROLES } from "@/lib/catalog";
import { fmtDate } from "@/lib/dates";
import { getDict } from "@/lib/i18n-server";
import { createUserAction, resetPasswordAction, updateUserAction } from "../actions";

export default async function UsersPage() {
  const me = await requireUser(["admin"]);
  const { t, lang } = await getDict();
  const list = await db.select().from(users).orderBy(asc(users.name));
  return (
    <div className="space-y-6">
      <h1>{t.navUsers}</h1>
      <ActionForm action={createUserAction} className="card" resetOnSuccess>
        <h2 className="mb-4">{t.newUser}</h2>
        <div className="grid gap-4 md:grid-cols-5">
          <div>
            <label className="label">{t.username}</label>
            <input name="username" className="input" required pattern="[a-zA-Z0-9._\-]{3,40}" placeholder="maria.perez" />
          </div>
          <div>
            <label className="label">{t.name}</label>
            <input name="name" className="input" required />
          </div>
          <div>
            <label className="label">{t.role}</label>
            <select name="role" className="input" defaultValue="agent">
              {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v[lang]}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t.tempPassword}</label>
            <input name="password" className="input" required minLength={8} />
          </div>
          <div className="flex items-end"><SubmitButton>{t.create}</SubmitButton></div>
        </div>
      </ActionForm>
      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr><th>{t.username}</th><th>{t.name}</th><th>{t.role}</th><th>{t.status}</th><th>{t.date}</th><th>{t.resetPassword}</th></tr>
          </thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id} className={u.active ? "" : "opacity-60"}>
                <td className="font-mono text-xs">{u.username}</td>
                <td>{u.name}</td>
                <td>
                  <form action={updateUserAction} className="flex gap-2">
                    <input type="hidden" name="id" value={u.id} />
                    <select name="role" defaultValue={u.role} className="input py-1" disabled={u.id === me.id}>
                      {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v[lang]}</option>)}
                    </select>
                    {u.id !== me.id && <button className="btn-secondary btn-sm">{t.save}</button>}
                  </form>
                </td>
                <td>
                  {u.id !== me.id ? (
                    <form action={updateUserAction}>
                      <input type="hidden" name="id" value={u.id} />
                      <input type="hidden" name="active" value={u.active ? "0" : "1"} />
                      <button className="btn-secondary btn-sm">{u.active ? t.deactivate : t.activate}</button>
                    </form>
                  ) : (
                    t.active
                  )}
                </td>
                <td className="text-xs text-slate-500">{fmtDate(u.createdAt, lang)}</td>
                <td>
                  <ActionForm action={resetPasswordAction} className="flex gap-2" resetOnSuccess>
                    <input type="hidden" name="id" value={u.id} />
                    <input name="password" className="input w-36 py-1" placeholder={t.tempPassword} minLength={8} required />
                    <SubmitButton className="btn-secondary btn-sm">{t.resetPassword}</SubmitButton>
                  </ActionForm>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
