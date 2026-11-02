import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appMeta } from "@/db/schema";
import { DICTS } from "./i18n";

// «Configuración · Campañas de llamadas»: values used when a campaign is created.
export type CampaignDefaults = { maxAttempts: number; followupDays: number; scriptEs: string; scriptEn: string };
const KEY = "campaign_defaults";

export async function campaignDefaults(): Promise<CampaignDefaults> {
  const [row] = await db.select().from(appMeta).where(eq(appMeta.key, KEY));
  const v = row ? (JSON.parse(row.value) as Partial<CampaignDefaults>) : {};
  return { maxAttempts: v.maxAttempts ?? 3, followupDays: v.followupDays ?? 5, scriptEs: v.scriptEs ?? DICTS.es.scriptText, scriptEn: v.scriptEn ?? "" };
}

export async function saveCampaignDefaults(d: CampaignDefaults) {
  const value = JSON.stringify(d);
  await db.insert(appMeta).values({ key: KEY, value }).onConflictDoUpdate({ target: appMeta.key, set: { value } });
}
