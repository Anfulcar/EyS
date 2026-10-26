import { eq } from "drizzle-orm";
import { Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { FileField } from "@/components/FileField";
import { RemoveFromFile } from "@/components/RemoveTasks";
import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n-server";
import { previewRemovalFileAction, removeTasksAction, uploadStatusAction } from "../../../actions";

export default async function StatusPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const me = await requireUser(["admin", "supervisor"]);
  const { t, lang } = await getDict();
  const campaign = await db.query.campaigns.findFirst({ where: eq(campaigns.id, id) });
  return (
    <div className="max-w-3xl space-y-6">
      <ActionForm action={uploadStatusAction} className="card space-y-4" resetOnSuccess>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2>{t.statusTitle}</h2>
          <a href="/api/status-template" className="btn-secondary">⬇ {t.downloadStatusTemplate}</a>
        </div>
        <p className="text-sm text-slate-600">{t.statusHelp}</p>
        <div className="space-y-2">
          <label className="choice flex items-center gap-2"><input type="radio" name="target" value={id} defaultChecked /> {t.campaign}: {lang === "es" ? "solo esta" : "this one only"}</label>
          <label className="choice flex items-center gap-2"><input type="radio" name="target" value="all" /> {lang === "es" ? "Todas las campañas no cerradas" : "All campaigns not closed"}</label>
        </div>
        <FileField label={t.chooseFile} required />
        <SubmitButton>{t.upload}</SubmitButton>
      </ActionForm>

      {/* Removing RUTs from this campaign with a file (administrators only; checked on the server too). */}
      {me.role === "admin" && campaign?.status !== "closed" && (
        <div className="card space-y-3 border-rose-200" data-testid="remove-from-file">
          <h2 className="flex items-center gap-2 text-rose-800"><Trash2 className="h-5 w-5" />{t.removeFileTitle}</h2>
          <p className="text-sm text-slate-600">{t.removeFileHelp}</p>
          <RemoveFromFile campaignId={id} t={t} preview={previewRemovalFileAction} action={removeTasksAction} />
        </div>
      )}
    </div>
  );
}
