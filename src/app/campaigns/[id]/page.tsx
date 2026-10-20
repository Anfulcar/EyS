import { eq } from "drizzle-orm";
import { StatsView } from "@/components/StatsView";
import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { todayLocal } from "@/lib/dates";
import { getDict } from "@/lib/i18n-server";
import { computeStats } from "@/lib/stats";

export default async function CampaignDashboard({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const c = (await db.query.campaigns.findFirst({ where: eq(campaigns.id, id) }))!;
  const { t, lang } = await getDict();
  const s = await computeStats([id]);
  const start = new Date(c.startDate).getTime();
  const end = new Date(c.endDate).getTime();
  const now = new Date(todayLocal()).getTime();
  const progress = Math.min(100, Math.max(0, Math.round(((now - start) / Math.max(1, end - start)) * 100)));
  const daysLeft = Math.max(0, Math.round((end - now) / 86400000));
  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{t.campaignProgress}</span>
          <span className="text-slate-500">{progress} % · {daysLeft} {t.daysLeft}</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand-600" style={{ width: `${progress}%` }} /></div>
      </div>
      <StatsView s={s} t={t} lang={lang} />
    </div>
  );
}
