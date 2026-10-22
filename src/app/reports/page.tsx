import { asc, desc, eq } from "drizzle-orm";
import { Download, FileDown, FileText, Pause, Pencil, Play, Presentation, RefreshCw, Trash2 } from "lucide-react";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/ActionForm";
import { Overlay } from "@/components/Overlay";
import { ReportBuilder } from "@/components/ReportBuilder";
import { Empty, SectionTitle } from "@/components/ui";
import { db } from "@/db";
import { campaigns, generatedReports, reportTemplates, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { fmtDate, fmtDateTime, nowIso } from "@/lib/dates";
import { getDict } from "@/lib/i18n-server";
import { cleanOptions, scheduleLabel, type Frequency } from "@/lib/report-options";
import { runDueReports } from "@/lib/report-run";
import { deleteReportTemplateAction, generateReportNowAction, pauseReportTemplateAction, saveReportTemplateAction } from "../actions";

export default async function ReportsPage() {
  const me = await requireUser(["admin", "supervisor"]);
  const { t, lang } = await getDict();
  await runDueReports().catch((e) => console.error("[reports]", e));
  const [files, templates, people, campaignList] = await Promise.all([
    db
      .select({ id: generatedReports.id, name: generatedReports.name, periodLabel: generatedReports.periodLabel, format: generatedReports.format, source: generatedReports.source, createdBy: generatedReports.createdBy, createdAt: generatedReports.createdAt })
      .from(generatedReports)
      .orderBy(desc(generatedReports.createdAt))
      .limit(200),
    db.select().from(reportTemplates).orderBy(asc(reportTemplates.name)),
    db.select({ id: users.id, name: users.name }).from(users),
    db.select({ id: campaigns.id, name: campaigns.name, status: campaigns.status }).from(campaigns).orderBy(desc(campaigns.startDate)),
  ]);
  const builderTemplates = templates.map((x) => ({ id: x.id, name: x.name, options: cleanOptions(JSON.parse(x.options)), frequency: x.frequency as Frequency, runDay: x.runDay }));
  // Same panel as in «Estadísticas globales»; «Editar» opens it with the template loaded.
  const builder = (initialTemplateId?: number) => (
    <ReportBuilder campaigns={campaignList} templates={builderTemplates} t={t} lang={lang} saveAction={saveReportTemplateAction} initialTemplateId={initialTemplateId} />
  );
  const names = new Map(people.map((p) => [p.id, p.name]));
  const seenBefore = me.reportsSeenAt ?? me.createdAt;
  // Opening this screen clears the "new reports" counter in the menu.
  await db.update(users).set({ reportsSeenAt: nowIso() }).where(eq(users.id, me.id));

  return (
    <div className="space-y-6">
      <div className="page-title">
        <div>
          <h1>{t.reportsTitle}</h1>
          <p className="subtitle">{t.reportsSubtitle}</p>
        </div>
        <Overlay variant="drawer" width="max-w-3xl" trigger={<><FileDown className="h-4 w-4" />{t.reportGenerate}</>} title={t.reportGenerate}>
          {builder()}
        </Overlay>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="px-5 pt-5"><SectionTitle icon={<FileText className="h-4 w-4" />}>{t.reportsGenerated}</SectionTitle></div>
        {files.length === 0 ? (
          <div className="p-5"><Empty>{t.reportsNone}</Empty></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>{t.reportsColReport}</th><th>{t.period}</th><th>{t.reportsColGenerated}</th><th /></tr></thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <div className="flex items-center gap-2 font-medium text-slate-900">
                        {f.format === "pptx" ? <Presentation className="h-4 w-4 text-mitur-orange" /> : <FileText className="h-4 w-4 text-mitur-red" />}
                        {f.name}
                        {f.createdAt > seenBefore && f.createdBy !== me.id && <span className="badge bg-mitur-red text-white">{t.reportsNew}</span>}
                      </div>
                      <div className="text-xs text-slate-500">{f.source === "scheduled" ? t.reportsScheduled : `${t.reportsOnDemand}${f.createdBy ? ` · ${names.get(f.createdBy) ?? ""}` : ""}`}</div>
                    </td>
                    <td className="whitespace-nowrap text-sm">{f.periodLabel}</td>
                    <td className="whitespace-nowrap text-sm">{fmtDateTime(f.createdAt, lang)}</td>
                    <td className="text-right"><a href={`/api/reports/${f.id}`} className="btn-secondary btn-sm" download><Download className="h-3.5 w-3.5" />{f.format === "pptx" ? "PowerPoint" : "PDF"}</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card overflow-hidden p-0">
        <div className="px-5 pt-5"><SectionTitle icon={<RefreshCw className="h-4 w-4" />}>{t.reportsTemplates}</SectionTitle></div>
        {templates.length === 0 ? (
          <div className="p-5"><Empty>{t.reportsNoTemplates}</Empty></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>{t.reportTemplateName}</th><th>{t.reportFrequency}</th><th>{t.reportsNextRun}</th><th /></tr></thead>
              <tbody>
                {templates.map((x) => {
                  const o = cleanOptions(JSON.parse(x.options));
                  const scheduled = x.frequency !== "none";
                  return (
                    <tr key={x.id}>
                      <td>
                        <div className="font-medium text-slate-900">{x.name}</div>
                        <div className="text-xs text-slate-500">{o.format === "pptx" ? "PowerPoint" : "PDF"} · {o.sections.length} {t.reportsSectionsCount}{x.createdBy ? ` · ${names.get(x.createdBy) ?? ""}` : ""}</div>
                      </td>
                      <td className="whitespace-nowrap">
                        <span className={`badge ${scheduled ? (x.paused ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-800") : "bg-slate-100 text-slate-600"}`}>
                          {scheduleLabel(x.frequency as Frequency, x.runDay, lang)}{x.paused ? ` · ${t.reportsPaused}` : ""}
                        </span>
                      </td>
                      <td className="whitespace-nowrap text-sm">{scheduled && !x.paused && x.nextRunOn ? fmtDate(x.nextRunOn, lang) : "—"}</td>
                      <td>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Overlay variant="drawer" width="max-w-3xl" triggerClassName="btn-secondary btn-sm" trigger={<><Pencil className="h-3.5 w-3.5" />{t.edit}</>} title={`${t.edit}: ${x.name}`}>
                            {builder(x.id)}
                          </Overlay>
                          <ActionForm action={generateReportNowAction}>
                            <input type="hidden" name="templateId" value={x.id} />
                            <SubmitButton className="btn-secondary btn-sm">{t.reportsGenerateNow}</SubmitButton>
                          </ActionForm>
                          {scheduled && (
                            <ActionForm action={pauseReportTemplateAction}>
                              <input type="hidden" name="templateId" value={x.id} />
                              <SubmitButton className="btn-secondary btn-sm">{x.paused ? <><Play className="h-3.5 w-3.5" />{t.reportsResume}</> : <><Pause className="h-3.5 w-3.5" />{t.reportsPause}</>}</SubmitButton>
                            </ActionForm>
                          )}
                          <ActionForm action={deleteReportTemplateAction}>
                            <input type="hidden" name="templateId" value={x.id} />
                            <ConfirmButton message={t.reportsDeleteConfirm} className="btn-secondary btn-sm"><Trash2 className="h-3.5 w-3.5" />{t.delete}</ConfirmButton>
                          </ActionForm>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
