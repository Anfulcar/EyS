import { eq } from "drizzle-orm";
import { AlertTriangle, FileText, Settings2, Power } from "lucide-react";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/ActionForm";
import { CampaignFields } from "@/components/CampaignFields";
import { SigturStatusBadge, SigturSwitch } from "@/components/SigturPermanentCard";
import { SectionTitle, StatusBadge } from "@/components/ui";
import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { DICTS, type Dict } from "@/lib/i18n";
import { getDict } from "@/lib/i18n-server";
import { deleteCampaignAction, setCampaignStatusAction, updateCampaignAction, updateScriptAction } from "../../../actions";

export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser(["admin", "supervisor"]);
  const id = Number((await params).id);
  const c = (await db.query.campaigns.findFirst({ where: eq(campaigns.id, id) }))!;
  const { t } = await getDict();
  // Administrators and supervisors edit the call script; the rest of the settings are for administrators.
  const script = (
    <ActionForm action={updateScriptAction} className="card space-y-4">
      <SectionTitle icon={<FileText className="h-4 w-4" />}>{t.scriptTitle}</SectionTitle>
      <input type="hidden" name="campaignId" value={id} />
      <p className="text-sm text-slate-500">{t.scriptHelp}</p>
      <div>
        <label className="label" htmlFor="script-es">{t.scriptEs}</label>
        <textarea id="script-es" name="scriptEs" rows={7} className="input" defaultValue={c.scriptEs ?? DICTS.es.scriptText} key={c.scriptEs ?? ""} />
      </div>
      <div>
        <label className="label" htmlFor="script-en">{t.scriptEn}</label>
        <textarea id="script-en" name="scriptEn" rows={5} className="input" defaultValue={c.scriptEn ?? ""} key={c.scriptEn ?? ""} placeholder={DICTS.en.scriptText} />
      </div>
      <div className="flex justify-end"><SubmitButton>{t.save}</SubmitButton></div>
    </ActionForm>
  );
  if (me.role !== "admin") return script;
  const statusLabel = t[`campaignStatus_${c.status}` as keyof Dict];
  return (
    <div className="space-y-6">
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <ActionForm action={updateCampaignAction} className="card space-y-5">
        <SectionTitle icon={<Settings2 className="h-4 w-4" />}>{t.campaignData}</SectionTitle>
        <input type="hidden" name="id" value={id} />
        <CampaignFields t={t} values={c} />
        <div className="flex justify-end"><SubmitButton>{t.save}</SubmitButton></div>
      </ActionForm>

      {c.kind === "sigtur_requests" ? (
        <div className="card space-y-4">
          <SectionTitle icon={<Power className="h-4 w-4" />}>{t.sigturReceiveRequests}</SectionTitle>
          <div className="flex flex-wrap items-center justify-between gap-3"><SigturStatusBadge paused={c.requestsPaused} t={t} /><SigturSwitch paused={c.requestsPaused} t={t} /></div>
          <p className="text-sm text-slate-500">{t.sigturPermanentLocked}</p>
        </div>
      ) : (
      <div className="space-y-6">
        <div className="card space-y-4">
          <SectionTitle icon={<Power className="h-4 w-4" />}>{t.campaignStatusTitle}</SectionTitle>
          <div className="flex items-center gap-2 text-sm text-slate-600">{t.currentStatus}: <StatusBadge status={c.status} label={statusLabel} /></div>
          <p className="text-sm text-slate-500">{t[`statusHelp_${c.status}` as keyof Dict]}</p>
          <form action={setCampaignStatusAction}>
            <input type="hidden" name="id" value={id} />
            {c.status === "active" ? (
              <><input type="hidden" name="status" value="closed" /><button className="btn-secondary w-full">{t.closeCampaign}</button></>
            ) : (
              <><input type="hidden" name="status" value="active" /><button className="btn w-full">{c.status === "closed" ? t.reopenCampaign : t.activateCampaign}</button></>
            )}
          </form>
        </div>

        <div className="card space-y-3 border-rose-200 bg-rose-50/40">
          <h2 className="flex items-center gap-2 text-rose-800"><AlertTriangle className="h-5 w-5" />{t.dangerZone}</h2>
          <p className="text-sm text-rose-900/80">{t.dangerHelp}</p>
          <ActionForm action={deleteCampaignAction}>
            <input type="hidden" name="id" value={id} />
            <ConfirmButton message={t.deleteCampaignConfirm} className="btn-danger w-full">{t.deleteCampaign}</ConfirmButton>
          </ActionForm>
        </div>
      </div>
      )}
    </div>
    {script}
    </div>
  );
}
