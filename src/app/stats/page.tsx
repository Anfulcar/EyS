import { desc } from "drizzle-orm";
import Link from "next/link";
import { StatsView } from "@/components/StatsView";
import { fmtPct, StatusBadge } from "@/components/ui";
import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { fmtDate } from "@/lib/dates";
import type { Dict } from "@/lib/i18n";
import { getDict } from "@/lib/i18n-server";
import { computeStats } from "@/lib/stats";

export default async function GlobalStatsPage({ searchParams }: { searchParams: Promise<{ include?: string }> }) {
  await requireUser(["admin", "supervisor"]);
  const { t, lang } = await getDict();
  const sp = await searchParams;
  const list = await db.select().from(campaigns).orderBy(desc(campaigns.startDate));
  const includeClosed = sp.include !== "open";
  const ids = list.filter((c) => includeClosed || c.status !== "closed").map((c) => c.id);
  const [all, per] = await Promise.all([computeStats(ids), Promise.all(list.map(async (c) => ({ c, s: await computeStats([c.id]) })))]);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1>{t.globalTitle}</h1>
        <div className="flex gap-2 text-sm">
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
