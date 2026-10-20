import { eq, ne } from "drizzle-orm";
import { DrillList } from "@/components/DrillList";
import { db } from "@/db";
import { campaigns, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { drillTitle } from "@/lib/drill-labels";
import { getDict } from "@/lib/i18n-server";
import { drillDown, parseDrill } from "@/lib/stats";

export default async function GlobalListPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser(["admin", "supervisor"]);
  const sp = await searchParams;
  const { t, lang } = await getDict();
  const f = parseDrill(sp);
  const ids = (await db.select({ id: campaigns.id }).from(campaigns).where(sp.include === "open" ? ne(campaigns.status, "closed") : undefined)).map((c) => c.id);
  const rows = await drillDown(ids, f);
  const agent = f.dim === "agent" && f.value ? (await db.query.users.findFirst({ where: eq(users.id, Number(f.value)) }))?.name : null;
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
  return <DrillList title={drillTitle(f, t, lang, agent)} rows={rows} backHref={`/stats${sp.include ? `?include=${sp.include}` : ""}`} backLabel={t.navStats} downloadHref={`/api/list?${qs}`} t={t} lang={lang} />;
}
