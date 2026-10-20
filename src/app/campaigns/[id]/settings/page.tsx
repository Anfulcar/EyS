import { eq } from "drizzle-orm";
import { AlertTriangle, Settings2, Power } from "lucide-react";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/ActionForm";
import { CampaignFields } from "@/components/CampaignFields";
import { SectionTitle, StatusBadge } from "@/components/ui";
import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import type { Dict } from "@/lib/i18n";
import { getDict } from "@/lib/i18n-server";
import { deleteCampaignAction, setCampaignStatusAction, updateCampaignAction } from "../../../actions";

export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser(["admin", "supervisor"]);
  const id = Number((await params).id);
  const c = (await db.query.campaigns.findFirst({ where: eq(campaigns.id, id) }))!;
  const { t } = await getDict();
  if (me.role !== "admin") return <p className="text-sm text-slate-500">—</p>;
  const statusLabel = t[`campaignStatus_${c.status}` as keyof Dict];
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <ActionForm action={updateCampaignAction} className="card space-y-5">
        <SectionTitle icon={<Settings2 className="h-4 w-4" />}>{t.campaignData}</SectionTitle>
        <input type="hidden" name="id" value={id} />
        <CampaignFields t={t} values={c} />
        <div className="flex justify-end"><SubmitButton>{t.save}</SubmitButton></div>
      </ActionForm>

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
    </div>
  );
}
