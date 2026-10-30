import { and, eq, isNotNull, sql } from "drizzle-orm";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { FileField } from "@/components/FileField";
import { db } from "@/db";
import { establishments } from "@/db/schema";
import { todayLocal } from "@/lib/dates";
import { HAS_EMAIL } from "@/lib/email";
import { getDict } from "@/lib/i18n-server";
import { markEmailsSentAction, uploadBouncesAction } from "../../../actions";

export default async function EmailPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { t } = await getDict();
  const [s] = await db
    .select({
      valid: sql<number>`sum(case when ${HAS_EMAIL} then 1 else 0 end)`,
      total: sql<number>`count(*)`,
      fixed: sql<number>`sum(case when ${establishments.correoActualizado} is not null then 1 else 0 end)`,
      sent: sql<number>`sum(case when ${establishments.correoEnviadoFecha} is not null then 1 else 0 end)`,
      bounced: sql<number>`sum(case when ${establishments.correoRebotado} = 'Sí' then 1 else 0 end)`,
    })
    .from(establishments)
    .where(eq(establishments.campaignId, id));
  const statuses = await db.selectDistinct({ s: establishments.estatusRnt }).from(establishments).where(and(eq(establishments.campaignId, id), isNotNull(establishments.estatusRnt)));
  return (
    <div className="space-y-6">
      <div className="card">
        <h2>{t.emailTitle}</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">{t.emailHelp}</p>
        <div className="mt-4 flex flex-wrap gap-8 text-sm">
          <div><div className="text-2xl font-semibold">{s?.valid ?? 0}</div><div className="text-slate-500">{t.withValidEmail}</div></div>
          <div><div className="text-2xl font-semibold">{s?.sent ?? 0}</div><div className="text-slate-500">{t.emailsSent}</div></div>
          <div><div className="text-2xl font-semibold">{s?.bounced ?? 0}</div><div className="text-slate-500">{t.emailsBounced}</div></div>
          <div><div className="text-2xl font-semibold">{s?.fixed ?? 0}</div><div className="text-slate-500">{t.emailsFixed}</div></div>
        </div>
        <a href={`/api/campaigns/${id}/mailmerge`} className="btn-secondary mt-4">⬇ {t.downloadMailMerge}</a>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <ActionForm action={markEmailsSentAction} className="card space-y-4">
          <h3>{t.markSent}</h3>
          <input type="hidden" name="campaignId" value={id} />
          <div><label className="label">{t.sentDate}</label><input type="date" name="date" className="input" defaultValue={todayLocal()} required /></div>
          <div>
            <label className="label">{t.applyTo}</label>
            <select name="estatus" className="input">
              <option value="">{t.withValidEmail}</option>
              {statuses.map((x) => <option key={x.s} value={x.s!}>{x.s}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="onlyUnsent" defaultChecked /> {t.emailsSent}: no</label>
          <SubmitButton>{t.save}</SubmitButton>
        </ActionForm>
        <ActionForm action={uploadBouncesAction} className="card space-y-4" resetOnSuccess>
          <h3>{t.bouncesUpload}</h3>
          <p className="text-sm text-slate-600">{t.bouncesHelp}</p>
          <input type="hidden" name="campaignId" value={id} />
          <FileField label={t.chooseFile} required />
          <SubmitButton>{t.upload}</SubmitButton>
        </ActionForm>
      </div>
    </div>
  );
}
