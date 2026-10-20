import { getDict } from "@/lib/i18n-server";

export default async function ExportPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { t } = await getDict();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="card space-y-3">
        <h2>{t.exportMatrix}</h2>
        <p className="text-sm text-slate-600">{t.exportMatrixHelp}</p>
        <a className="btn" href={`/api/campaigns/${id}/export`}>⬇ {t.download}</a>
      </div>
      <div className="card space-y-3">
        <h2>{t.exportCalls}</h2>
        <p className="text-sm text-slate-600">CSV (UTF-8)</p>
        <a className="btn-secondary" href={`/api/campaigns/${id}/calls`}>⬇ {t.download}</a>
      </div>
    </div>
  );
}
