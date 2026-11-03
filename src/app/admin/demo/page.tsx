import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/ActionForm";
import { AdminTabs } from "@/components/AdminTabs";
import { demoConfigured, isDemoRequest } from "@/db";
import { requireUser } from "@/lib/auth";
import { fmtDateTime } from "@/lib/dates";
import { demoSettings } from "@/lib/demo";
import { getDict } from "@/lib/i18n-server";
import { resetDemoAction, saveDemoSettingsAction } from "../../actions";

// «Administración general → Demo»: switch the demo on, choose its password, reset its made-up data.
export default async function DemoSettingsPage() {
  if (isDemoRequest()) notFound();
  const me = await requireUser("g.perms");
  const { t, lang } = await getDict();
  const s = await demoSettings();
  const h = await headers();
  const link = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? ""}/login/demo`;
  return (
    <div className="space-y-6">
      <AdminTabs t={t} me={me} />
      <div>
        <h2>{t.demoTitle}</h2>
        <p className="subtitle max-w-3xl">{t.demoSubtitle}</p>
      </div>
      {!demoConfigured && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900" data-testid="demo-not-configured">{t.demoNotConfigured}</p>}
      <ActionForm action={saveDemoSettingsAction} className="card max-w-2xl space-y-4">
        <label className="flex items-start gap-3">
          <input type="checkbox" name="enabled" value="1" defaultChecked={s.enabled} className="mt-1 h-4 w-4 accent-brand-600" disabled={!demoConfigured} />
          <span><span className="font-semibold text-slate-900">{t.demoOn}</span><span className="block text-xs text-slate-500">{t.demoOnHelp}</span></span>
        </label>
        <div>
          <label className="label" htmlFor="demo-new-password">{t.demoNewPassword}</label>
          <input id="demo-new-password" name="password" type="password" minLength={8} className="input max-w-sm" autoComplete="new-password" disabled={!demoConfigured} />
          <p className="mt-1 text-xs text-slate-500">{s.hash ? t.demoPasswordSet : t.demoPasswordNone} {t.demoPasswordKeep}</p>
        </div>
        {s.enabled && s.hash && demoConfigured && (
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
            <div className="label">{t.demoShare}</div>
            <code className="break-all text-slate-800">{link}</code>
          </div>
        )}
        <div className="flex justify-end"><SubmitButton>{t.save}</SubmitButton></div>
      </ActionForm>
      {demoConfigured && (
        <div className="card max-w-2xl space-y-3">
          <h3>{t.demoReset}</h3>
          <p className="text-sm text-slate-600">{t.demoResetHelp}</p>
          <p className="text-xs text-slate-500">{s.resetAt ? t.demoLastReset.replace("{d}", fmtDateTime(s.resetAt, lang)).replace("{p}", s.resetBy ?? "—") : t.demoNeverReset}</p>
          <ActionForm action={resetDemoAction}>
            <ConfirmButton message={t.demoResetConfirm} className="btn-secondary" confirmLabel={t.demoReset}>{t.demoReset}</ConfirmButton>
          </ActionForm>
        </div>
      )}
    </div>
  );
}
