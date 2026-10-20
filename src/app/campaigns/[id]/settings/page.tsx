import { eq } from "drizzle-orm";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/ActionForm";
import { CampaignFields } from "@/components/CampaignFields";
import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n-server";
import { deleteCampaignAction, setCampaignStatusAction, updateCampaignAction } from "../../../actions";

export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser(["admin", "supervisor"]);
  const id = Number((await params).id);
  const c = (await db.query.campaigns.findFirst({ where: eq(campaigns.id, id) }))!;
  const { t } = await getDict();
  if (me.role !== "admin") return <p className="text-sm text-slate-500">—</p>;
  return (
    <div className="space-y-6">
      <ActionForm action={updateCampaignAction} className="card space-y-4">
        <input type="hidden" name="id" value={id} />
        <CampaignFields t={t} values={c} />
        <SubmitButton>{t.save}</SubmitButton>
      </ActionForm>
      <div className="card flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">{t.status}:</span>
        {c.status !== "active" && (
          <form action={setCampaignStatusAction}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="active" /><button className="btn">{c.status === "closed" ? t.reopenCampaign : t.activateCampaign}</button></form>
        )}
        {c.status === "active" && (
          <form action={setCampaignStatusAction}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="closed" /><button className="btn-secondary">{t.closeCampaign}</button></form>
        )}
        <form action={deleteCampaignAction} className="ml-auto">
          <input type="hidden" name="id" value={id} />
          <ConfirmButton message={t.deleteCampaignConfirm}>{t.deleteCampaign}</ConfirmButton>
        </form>
      </div>
    </div>
  );
}
