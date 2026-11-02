import { asc } from "drizzle-orm";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { AdminTabs } from "@/components/AdminTabs";
import { Avatar } from "@/components/Avatar";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ROLES } from "@/lib/catalog";
import type { Dict } from "@/lib/i18n";
import { getDict } from "@/lib/i18n-server";
import { savePermissionsAction } from "../../actions";

const LEVELS = ["none", "register", "manage", "supervise"] as const;

// «Permisos por módulo»: besides the role, who uses the call campaigns and with which level «Quejas y reclamaciones».
export default async function PermissionsPage() {
  await requireUser(["admin"]);
  const { t, lang } = await getDict();
  const people = await db.select().from(users).orderBy(asc(users.name));
  const lv = (k: string) => t[`qrLevel_${k}` as keyof Dict];
  return (
    <div className="space-y-6">
      <AdminTabs t={t} />
      <div>
        <h2>{t.permTitle}</h2>
        <p className="subtitle max-w-3xl">{t.permHelp}</p>
      </div>
      <ActionForm action={savePermissionsAction} className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="table" data-testid="permissions">
            <thead>
              <tr><th>{t.name}</th><th>{t.permCalls}</th><th>{t.permQr}</th><th>{t.permAdmin}</th></tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id} className={p.active ? "" : "opacity-50"}>
                  <td className="min-w-[14rem]">
                    <input type="hidden" name={`present-${p.id}`} value="1" />
                    <div className="flex items-center gap-3">
                      <Avatar name={p.name} size="sm" />
                      <div><div className="font-medium text-slate-900">{p.name}</div><div className="text-xs text-slate-500">{p.username} · {ROLES[p.role]?.[lang]}</div></div>
                    </div>
                  </td>
                  <td>
                    {p.role === "admin" ? (
                      <span className="badge bg-brand-50 text-brand-700">{t.permAlways}</span>
                    ) : p.role === "complaints" ? (
                      <span className="text-slate-400" title={t.permComplaintsRole}>—</span>
                    ) : (
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input type="checkbox" name={`calls-${p.id}`} value="1" defaultChecked={p.callsAccess} className="h-4 w-4 accent-brand-600" aria-label={`${p.name}: ${t.permCalls}`} /> {t.permAccess}
                      </label>
                    )}
                  </td>
                  <td>
                    {p.role === "admin" ? (
                      <span className="badge bg-brand-50 text-brand-700">{t.permAlways}</span>
                    ) : (
                    <select name={`qr-${p.id}`} defaultValue={p.qrLevel} className="input w-44 py-1.5" aria-label={`${p.name}: ${t.permQr}`}>
                      {LEVELS.map((k) => <option key={k} value={k}>{lv(k)}</option>)}
                    </select>
                    )}
                  </td>
                  <td>{p.role === "admin" ? <span className="badge bg-brand-50 text-brand-700">{t.yes}</span> : <span className="text-slate-400">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
          <p className="text-xs text-slate-500">{t.permQrSoon}</p>
          <SubmitButton>{t.save}</SubmitButton>
        </div>
      </ActionForm>
      <div className="card space-y-1.5 text-sm">
        <h3 className="mb-1">{t.permQr}</h3>
        {LEVELS.map((k) => <div key={k}><b>{lv(k)}:</b> <span className="text-slate-600">{t[`qrLevelHelp_${k}` as keyof Dict]}</span></div>)}
      </div>
    </div>
  );
}
