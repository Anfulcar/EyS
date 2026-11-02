import { and, asc, eq, inArray } from "drizzle-orm";
import { PhoneIncoming, SlidersHorizontal, Users2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { SigturStatusBadge, SigturSwitch } from "@/components/SigturPermanentCard";
import { SectionTitle } from "@/components/ui";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { idsWho } from "@/lib/permissions";
import { fmtDateTime } from "@/lib/dates";
import { getDict } from "@/lib/i18n-server";
import { campaignDefaults } from "@/lib/settings";
import { requestsCampaign } from "@/lib/sigtur";
import { saveAutoAssigneesAction, saveCampaignDefaultsAction, simulateCallRequestAction } from "../actions";

// «Configuración · Campañas de llamadas»: what is set for the whole calls module (administrators and supervisors).
export default async function CallsSettingsPage() {
  await requireUser("c.settings");
  const { t, lang } = await getDict();
  const [d, campaign, staff] = await Promise.all([
    campaignDefaults(),
    requestsCampaign(),
    idsWho("c.call").then((ids) => db.select({ id: users.id, name: users.name }).from(users).where(and(eq(users.active, true), inArray(users.id, ids))).orderBy(asc(users.name))),
  ]);
  const chosen = new Set<number>(campaign.autoAssignees ? JSON.parse(campaign.autoAssignees) : []);

  return (
    <div className="space-y-6">
      <div className="page-title">
        <div>
          <h1>{t.callsSettingsTitle}</h1>
          <p className="subtitle max-w-3xl">{t.callsSettingsSubtitle}</p>
        </div>
      </div>

      <ActionForm action={saveCampaignDefaultsAction} className="card space-y-4">
        <SectionTitle icon={<SlidersHorizontal className="h-4 w-4" />}>{t.defaultsTitle}</SectionTitle>
        <p className="text-sm text-slate-600">{t.defaultsHelp}</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label" htmlFor="d-attempts">{t.maxAttempts}</label>
            <input id="d-attempts" name="maxAttempts" type="number" min={1} max={10} className="input" defaultValue={d.maxAttempts} />
            <p className="mt-1 text-xs text-slate-500">{t.maxAttemptsHelp}</p>
          </div>
          <div>
            <label className="label" htmlFor="d-followup">{t.followupDays}</label>
            <input id="d-followup" name="followupDays" type="number" min={1} max={30} className="input" defaultValue={d.followupDays} />
            <p className="mt-1 text-xs text-slate-500">{t.followupDaysHelp}</p>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div><label className="label" htmlFor="d-script-es">{t.defaultsScriptEs}</label><textarea id="d-script-es" name="scriptEs" rows={7} className="input" defaultValue={d.scriptEs} /></div>
          <div><label className="label" htmlFor="d-script-en">{t.defaultsScriptEn}</label><textarea id="d-script-en" name="scriptEn" rows={7} className="input" defaultValue={d.scriptEn} /></div>
        </div>
        <div className="flex justify-end"><SubmitButton>{t.save}</SubmitButton></div>
      </ActionForm>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6 lg:col-span-2 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
          <div className="card space-y-3">
            <SectionTitle icon={<PhoneIncoming className="h-4 w-4" />}>{t.sigturReceiveRequests}</SectionTitle>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
              <SigturStatusBadge paused={campaign.requestsPaused} t={t} />
              <SigturSwitch paused={campaign.requestsPaused} t={t} />
            </div>
            {campaign.requestsPaused && campaign.pausedAt && <p className="text-xs text-slate-500">{fmtDateTime(campaign.pausedAt, lang)}</p>}
          </div>

          <div className="card space-y-3">
            <SectionTitle icon={<Users2 className="h-4 w-4" />}>{t.integrationAssignees}</SectionTitle>
            <p className="text-sm text-slate-600">{t.integrationAssigneesHelp}</p>
            <ActionForm action={saveAutoAssigneesAction} className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                {staff.map((s) => (
                  <label key={s.id} className="choice">
                    <input type="checkbox" name="people" value={s.id} defaultChecked={chosen.has(s.id)} className="h-4 w-4 accent-brand-600" /> {s.name}
                  </label>
                ))}
              </div>
              <div className="flex justify-end"><SubmitButton className="btn-secondary">{t.save}</SubmitButton></div>
            </ActionForm>
          </div>

          <div className="card space-y-3">
            <SectionTitle icon={<PhoneIncoming className="h-4 w-4" />}>{t.integrationSimulate}</SectionTitle>
            <p className="text-sm text-slate-600">{t.integrationSimulateHelp}</p>
            <ActionForm action={simulateCallRequestAction} className="grid gap-3 sm:grid-cols-2" resetOnSuccess>
              <div><label className="label" htmlFor="sim-id">ID SIGTUR</label><input id="sim-id" name="idSigtur" className="input" required /></div>
              <div><label className="label" htmlFor="sim-name">{t.company}</label><input id="sim-name" name="nombreComercial" className="input" /></div>
              <div><label className="label" htmlFor="sim-phone">{t.phoneNumber}</label><input id="sim-phone" name="telefono" className="input font-mono" /></div>
              <div><label className="label" htmlFor="sim-reason">{t.integrationReason}</label><input id="sim-reason" name="motivo" className="input" required /></div>
              <div className="sm:col-span-2 flex justify-end"><SubmitButton>{t.integrationSimulateButton}</SubmitButton></div>
            </ActionForm>
          </div>
        </div>
      </div>
    </div>
  );
}
