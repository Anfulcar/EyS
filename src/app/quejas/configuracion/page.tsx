import { headers } from "next/headers";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { ListEditor } from "@/components/qr/ListEditor";
import { getDict } from "@/lib/i18n-server";
import { qrSettings, QR_TYPES } from "@/lib/qr";
import { requireQr } from "@/lib/qr-auth";
import { QR_TEXT, QR_TYPE_TEXT } from "@/lib/qr-i18n";
import { saveQrListsAction, saveQrPublicFormAction, saveQrSlaAction } from "../actions";

// «Configuración del módulo»: administrators and module supervisors, laid out as in the preview.
export default async function QrSettingsPage() {
  await requireQr("supervise");
  const { lang } = await getDict();
  const t = QR_TEXT[lang];
  const s = await qrSettings();
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? ""}`;
  return (
    <div className="space-y-5">
      <div className="page-title"><div><h1>{t.navModuleSettings}</h1><p className="subtitle max-w-3xl">{t.settingsSub}</p></div></div>

      <ActionForm action={saveQrSlaAction} className="card space-y-3 p-0">
        <div className="px-5 pt-5">
          <h3>{t.slaTitle}</h3>
          <p className="mt-1 text-sm text-slate-600">{t.slaHelp}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="table" data-testid="qr-sla">
            <thead><tr><th>{t.fType}</th><th>{t.slaFirst}</th><th>{t.slaResp}</th></tr></thead>
            <tbody>
              {QR_TYPES.map((x) => (
                <tr key={x}>
                  <td className="font-semibold">{QR_TYPE_TEXT[lang][x]}</td>
                  <td><input name={`first-${x}`} type="number" min={1} max={60} defaultValue={s.sla[x]?.first} className="input w-24" aria-label={`${QR_TYPE_TEXT[lang][x]}: ${t.slaFirst}`} /></td>
                  <td><input name={`resp-${x}`} type="number" min={1} max={180} defaultValue={s.sla[x]?.resp} className="input w-24" aria-label={`${QR_TYPE_TEXT[lang][x]}: ${t.slaResp}`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-5 pb-5 text-sm">
          <label htmlFor="warn">{t.warnBefore}</label>
          <input id="warn" name="warnDays" type="number" min={1} max={20} defaultValue={s.warnDays} className="input w-20" />
          <span>{t.businessDays}</span>
          <span className="flex-1" />
          <SubmitButton>{t.saveSla}</SubmitButton>
        </div>
      </ActionForm>

      <div className="grid gap-5 lg:grid-cols-2">
        <ActionForm action={saveQrListsAction} className="card space-y-3">
          <input type="hidden" name="list" value="topics" />
          <h3>{t.topics}</h3>
          <ListEditor name="items" items={s.topics} addLabel={t.addTopic} label={t.topics} />
          <div className="flex justify-end"><SubmitButton>{t.saveList}</SubmitButton></div>
        </ActionForm>
        <ActionForm action={saveQrListsAction} className="card space-y-3">
          <input type="hidden" name="list" value="institutions" />
          <h3>{t.institutions}</h3>
          <ListEditor name="items" items={s.institutions} addLabel={t.addInstitution} label={t.institutions} />
          <div className="flex justify-end"><SubmitButton>{t.saveList}</SubmitButton></div>
        </ActionForm>
      </div>

      <ActionForm action={saveQrPublicFormAction} className="card space-y-2">
        <h3>{t.publicFormTitle}</h3>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="publicForm" value="1" defaultChecked={s.publicForm} className="h-4 w-4 accent-brand-600" /> {t.publicFormOn}</label>
        <p className="text-sm text-slate-600">{t.publicFormHelp} <span className="break-all font-mono text-xs">{origin}/formulario-quejas</span></p>
        <div className="flex justify-end"><SubmitButton>{t.saveList}</SubmitButton></div>
      </ActionForm>
    </div>
  );
}
