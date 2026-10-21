import "server-only";
import { and, eq, inArray, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { nowIso } from "./dates";

// "Needs attention" = in "Para hoy": never called, a retry or a follow-up whose time has come.
export function dueCondition(now = nowIso()): SQL {
  return and(
    inArray(companies.status, ["pending", "retry", "followup"]),
    or(isNull(companies.nextActionAt), lte(companies.nextActionAt, now)),
    sql`exists (select 1 from establishments e where e.company_id = ${companies.id})`,
  )!;
}

export async function attentionSummary(userId: number, campaignIds?: number[]) {
  if (campaignIds && !campaignIds.length) return { total: 0, overdueFollowups: 0, dueToday: 0 };
  // Without a list, "open campaigns" is part of the same database question (one round trip).
  const inCampaigns = campaignIds
    ? inArray(companies.campaignId, campaignIds)
    : sql`${companies.campaignId} in (select c.id from campaigns c where c.status <> 'closed')`;
  const [r] = await db
    .select({
      total: sql<number>`count(*)`,
      followups: sql<number>`sum(case when ${companies.status} = 'followup' then 1 else 0 end)`,
    })
    .from(companies)
    .where(and(inCampaigns, eq(companies.assignedUserId, userId), dueCondition()));
  const total = Number(r?.total ?? 0);
  const overdueFollowups = Number(r?.followups ?? 0);
  return { total, overdueFollowups, dueToday: total - overdueFollowups };
}

// Whole calendar days (Dominican Republic time) between a moment and now.
export function daysSince(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return null;
  const day = (ms: number) => Math.floor((ms - 4 * 3600000) / 86400000);
  return Math.max(0, day(now) - day(new Date(iso).getTime()));
}
