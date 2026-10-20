import { eq } from "drizzle-orm";
import { DrillList } from "@/components/DrillList";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { drillTitle } from "@/lib/drill-labels";
import { getDict } from "@/lib/i18n-server";
import { drillDown, parseDrill } from "@/lib/stats";

export default async function CampaignListPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser(["admin", "supervisor"]);
  const id = Number((await params).id);
  const sp = await searchParams;
  const { t, lang } = await getDict();
  const f = parseDrill(sp);
  const rows = await drillDown([id], f);
  const agent = f.dim === "agent" && f.value ? (await db.query.users.findFirst({ where: eq(users.id, Number(f.value)) }))?.name : null;
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
  qs.set("campaign", String(id));
  return <DrillList title={drillTitle(f, t, lang, agent)} rows={rows} backHref={`/campaigns/${id}`} backLabel={t.tabDashboard} downloadHref={`/api/list?${qs}`} t={t} lang={lang} />;
}
