import { eq } from "drizzle-orm";
import { StatsView } from "@/components/StatsView";
import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { todayLocal } from "@/lib/dates";
import { getDict } from "@/lib/i18n-server";
import { computeStats } from "@/lib/stats";

export default async function CampaignDashboard({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const [c0, { t, lang }, s] = await Promise.all([db.query.campaigns.findFirst({ where: eq(campaigns.id, id) }), getDict(), computeStats([id])]);
  const c = c0!;
  const start = new Date(c.startDate).getTime();
  const end = new Date(c.endDate).getTime();
  const now = new Date(todayLocal()).getTime();
  const progress = Math.min(100, Math.max(0, Math.round(((now - start) / Math.max(1, end - start)) * 100)));
  const daysLeft = Math.max(0, Math.round((end - now) / 86400000));
  return <StatsView s={s} t={t} lang={lang} period={{ progress, daysLeft }} listHref={`/campaigns/${id}/list`} agentHref={`/agents/{id}?campaign=${id}`} />;
}
