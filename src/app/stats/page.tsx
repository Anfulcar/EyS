import { asc, desc } from "drizzle-orm";
import { FileDown } from "lucide-react";
import Link from "next/link";
import { Overlay } from "@/components/Overlay";
import { ReportBuilder } from "@/components/ReportBuilder";
import { StatsView } from "@/components/StatsView";
import { fmtPct, StatusBadge } from "@/components/ui";
import { db } from "@/db";
import { campaigns, reportTemplates } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { fmtDate } from "@/lib/dates";
import type { Dict } from "@/lib/i18n";
import { getDict } from "@/lib/i18n-server";
import { cleanOptions, type Frequency } from "@/lib/report-options";
import { runDueReports } from "@/lib/report-run";
import { computeStatsByCampaign } from "@/lib/stats";
import { saveReportTemplateAction } from "../actions";

export default async function GlobalStatsPage({ searchParams }: { searchParams: Promise<{ include?: string }> }) {
  const [, { t, lang }, sp, list, templates] = await Promise.all([
    requireUser(["admin", "supervisor"]),
    getDict(),
    searchParams,
    db.select().from(campaigns).orderBy(desc(campaigns.startDate)),
    db.select().from(reportTemplates).orderBy(asc(reportTemplates.name)),
    runDueReports().catch((e) => console.error("[reports]", e)),
  ]);
  const includeClosed = sp.include !== "open";
  const ids = list.filter((c) => includeClosed || c.status !== "closed").map((c) => c.id);
  const byCampaign = await computeStatsByCampaign(list.map((c) => c.id), ids);
  const all = byCampaign.all;
  const per = list.map((c) => ({ c, s: byCampaign.per.get(c.id)! }));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1>{t.globalTitle}</h1>
        <div className="flex flex-wrap gap-2 text-sm">
          <Overlay variant="drawer" width="max-w-3xl" triggerClassName="btn btn-sm" trigger={<><FileDown className="h-4 w-4" />{t.reportGenerate}</>} title={t.reportGenerate}>
            <ReportBuilder
              campaigns={list.map((c) => ({ id: c.id, name: c.name, status: c.status }))}
              templates={templates.map((x) => ({ id: x.id, name: x.name, options: cleanOptions(JSON.parse(x.options)), frequency: x.frequency as Frequency, runDay: x.runDay }))}
              t={t}
              lang={lang}
              saveAction={saveReportTemplateAction}
            />
          </Overlay>
          <Link href="/reports" className="btn-secondary btn-sm">{t.navReports}</Link>
          <Link href="/stats" className={includeClosed ? "btn btn-sm" : "btn-secondary btn-sm"}>{t.all}</Link>
          <Link href="/stats?include=open" className={!includeClosed ? "btn btn-sm" : "btn-secondary btn-sm"}>{t.campaignStatus_active} / {t.campaignStatus_draft}</Link>
        </div>
      </div>
      <div className="card overflow-x-auto p-0">
        <h3 className="px-4 pt-4">{t.campaignsCompared}</h3>
        <table className="table mt-2">
          <thead>
            <tr>
              <th>{t.campaign}</th><th>{t.period}</th><th className="text-right">{t.universe}</th><th className="text-right">{t.kpiCalled}</th><th className="text-right">{t.kpiContact}</th>
              <th className="text-right">{t.kpiCommitments}</th><th className="text-right">{t.kpiCompliance}</th><th className="text-right">{t.kpiClosed}</th><th className="text-right">{t.kpiAdvanceExpired}</th>
            </tr>
          </thead>
          <tbody>
            {per.map(({ c, s }) => (
              <tr key={c.id}>
                <td><Link className="font-medium text-brand-700 hover:underline" href={`/campaigns/${c.id}`}>{c.name}</Link> <StatusBadge status={c.status} label={t[`campaignStatus_${c.status}` as keyof Dict]} /></td>
                <td className="whitespace-nowrap text-xs">{fmtDate(c.startDate, lang)} – {fmtDate(c.endDate, lang)}</td>
                <td className="text-right tabular-nums">{s.universe}</td>
                <td className="text-right tabular-nums">{fmtPct(s.called, s.universe)}</td>
                <td className="text-right tabular-nums">{fmtPct(s.contactedEffective, s.called)}</td>
                <td className="text-right tabular-nums">{fmtPct(s.commitments, s.operatingContacted)}</td>
                <td className="text-right tabular-nums">{fmtPct(s.commitmentsKept, s.commitmentsDue)}</td>
                <td className="text-right tabular-nums">{s.closed}</td>
                <td className="text-right tabular-nums">{fmtPct(s.expiredInProcess, s.expiredOperating)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <StatsView s={all} t={t} lang={lang} listHref={includeClosed ? "/stats/list" : "/stats/list?include=open"} />
    </div>
  );
}
