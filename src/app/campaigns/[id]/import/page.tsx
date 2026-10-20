import { desc, eq } from "drizzle-orm";
import { ImportForm } from "@/components/ImportForm";
import { db } from "@/db";
import { importLogs, users } from "@/db/schema";
import { fmtDateTime } from "@/lib/dates";
import { getDict } from "@/lib/i18n-server";
import { commitUploadAction, previewUploadAction } from "../../../actions";

export default async function ImportPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { t, lang } = await getDict();
  const logs = await db
    .select({ l: importLogs, user: users.name })
    .from(importLogs)
    .leftJoin(users, eq(users.id, importLogs.userId))
    .where(eq(importLogs.campaignId, id))
    .orderBy(desc(importLogs.createdAt))
    .limit(20);
  return (
    <div className="space-y-6">
      <div className="card space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2>{t.importTitle}</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">{t.importHelp}</p>
          </div>
          <a href="/api/template" className="btn-secondary">⬇ {t.downloadTemplate}</a>
        </div>
        <ImportForm campaignId={id} t={t} preview={previewUploadAction} commit={commitUploadAction} />
      </div>
      {logs.length > 0 && (
        <div className="card overflow-x-auto p-0">
          <h3 className="px-4 pt-4">{t.importHistory}</h3>
          <table className="table mt-2">
            <thead><tr><th>{t.date}</th><th>Tipo</th><th>Archivo</th><th className="text-right">Filas</th><th className="text-right">{t.inserted}</th><th className="text-right">{t.updated}</th><th className="text-right">{t.skipped}</th><th>{t.username}</th></tr></thead>
            <tbody>
              {logs.map(({ l, user }) => (
                <tr key={l.id}><td className="text-xs">{fmtDateTime(l.createdAt, lang)}</td><td>{l.kind}</td><td>{l.fileName}</td><td className="text-right">{l.rows}</td><td className="text-right">{l.inserted}</td><td className="text-right">{l.updated}</td><td className="text-right">{l.skipped}</td><td>{user}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
