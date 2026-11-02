import { headers } from "next/headers";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { QrTabs } from "@/components/qr/QrTabs";
import { getDict } from "@/lib/i18n-server";
import { qrSettings, QR_TYPES } from "@/lib/qr";
import { requireQr } from "@/lib/qr-auth";
import { QR_TEXT, QR_TYPE_TEXT } from "@/lib/qr-i18n";
import { saveQrSettingsAction } from "../actions";

// «Configuración · Quejas y reclamaciones»: administrators and module supervisors.
export default async function QrSettingsPage() {
  const u = await requireQr("supervise");
  const { t: common, lang } = await getDict();
  const t = QR_TEXT[lang];
  const s = await qrSettings();
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? ""}`;
  return (
    <div className="space-y-5">
      <div className="page-title"><div><h1>{t.settingsTitle}</h1><p className="subtitle max-w-3xl">{t.settingsSub}</p></div></div>
      <QrTabs t={t} u={u} />
      <ActionForm action={saveQrSettingsAction} className="space-y-5">
        <div className="card space-y-3">
          <h3>{t.slaTitle}</h3>
          <p className="text-sm text-slate-600">{t.slaHelp}</p>
          <div className="overflow-x-auto">
            <table className="table" data-testid="qr-sla">
              <thead><tr><th>{t.fType}</th><th>{t.slaFirst}</th><th>{t.slaResp}</th></tr></thead>
              <tbody>
                {QR_TYPES.map((x) => (
                  <tr key={x}>
                    <td className="font-medium">{QR_TYPE_TEXT[lang][x]}</td>
                    <td><input name={`first-${x}`} type="number" min={1} max={60} defaultValue={s.sla[x]?.first} className="input w-24" aria-label={`${QR_TYPE_TEXT[lang][x]}: ${t.slaFirst}`} /></td>
                    <td><input name={`resp-${x}`} type="number" min={1} max={180} defaultValue={s.sla[x]?.resp} className="input w-24" aria-label={`${QR_TYPE_TEXT[lang][x]}: ${t.slaResp}`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-2 text-sm"><label htmlFor="warn">{t.warnDays}</label><input id="warn" name="warnDays" type="number" min={1} max={20} defaultValue={s.warnDays} className="input w-20" /></div>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="card space-y-2"><label className="font-semibold text-slate-900" htmlFor="topics">{t.topics}</label><p className="text-xs text-slate-500">{t.oneLine}</p><textarea id="topics" name="topics" rows={9} className="input" defaultValue={s.topics.join("\n")} /></div>
          <div className="card space-y-2"><label className="font-semibold text-slate-900" htmlFor="inst">{t.institutions}</label><p className="text-xs text-slate-500">{t.oneLine}</p><textarea id="inst" name="institutions" rows={9} className="input" defaultValue={s.institutions.join("\n")} /></div>
        </div>
        <div className="card space-y-2">
          <h3>{t.publicFormTitle}</h3>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="publicForm" value="1" defaultChecked={s.publicForm} className="h-4 w-4 accent-brand-600" /> {t.publicFormOn}</label>
          <p className="text-sm text-slate-600">{t.publicFormHelp} <span className="break-all font-mono text-xs">{origin}/formulario-quejas</span></p>
        </div>
        <div className="flex justify-end"><SubmitButton>{common.save}</SubmitButton></div>
      </ActionForm>
    </div>
  );
}
