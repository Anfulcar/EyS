import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { FileField } from "@/components/FileField";
import { getDict } from "@/lib/i18n-server";
import { uploadStatusAction } from "../../../actions";

export default async function StatusPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { t, lang } = await getDict();
  return (
    <ActionForm action={uploadStatusAction} className="card max-w-3xl space-y-4" resetOnSuccess>
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
  );
}
