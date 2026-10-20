import "server-only";
import { and, desc, eq, gte, inArray, isNotNull, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { db } from "@/db";
import { callAttempts, callResults, campaigns, companies, establishments, users, type User } from "@/db/schema";
import { localDayEnd, localDayStart } from "./dates";

export type CallFilters = { campaign?: string; agent?: string; code?: string; from?: string; to?: string; review?: string };

// Agents only ever see their own calls; administrators and supervisors see everyone's.
function scope(me: User): SQL | undefined {
  return me.role === "agent" ? eq(callAttempts.userId, me.id) : undefined;
}

export function canSeeAllCalls(me: User) {
  return me.role === "admin" || me.role === "supervisor";
}

function where(me: User, f: CallFilters): SQL | undefined {
  const w: SQL[] = [];
  const s = scope(me);
  if (s) w.push(s);
  if (f.campaign) w.push(eq(callAttempts.campaignId, Number(f.campaign)));
  if (f.agent && canSeeAllCalls(me)) w.push(eq(callAttempts.userId, Number(f.agent)));
  if (f.from) w.push(gte(callAttempts.calledAt, localDayStart(f.from)));
  if (f.to) w.push(lte(callAttempts.calledAt, localDayEnd(f.to)));
  if (f.review === "yes") w.push(isNotNull(callAttempts.reviewedAt));
  if (f.review === "no") w.push(isNull(callAttempts.reviewedAt));
  if (f.code) {
    w.push(
      or(
        eq(callAttempts.noContactCode, f.code),
        sql`exists (select 1 from call_results r where r.attempt_id = ${callAttempts.id} and r.code = ${f.code})`,
      )!,
    );
  }
  return w.length ? and(...w) : undefined;
}

export async function callRows(me: User, f: CallFilters, limit: number, offset = 0) {
  const rows = await db
    .select({ a: callAttempts, agent: users.name, campaign: campaigns.name, razonSocial: companies.razonSocial, companyKey: companies.key })
    .from(callAttempts)
    .innerJoin(users, eq(users.id, callAttempts.userId))
    .innerJoin(campaigns, eq(campaigns.id, callAttempts.campaignId))
    .innerJoin(companies, eq(companies.id, callAttempts.companyId))
    .where(where(me, f))
    .orderBy(desc(callAttempts.calledAt), desc(callAttempts.id))
    .limit(limit)
    .offset(offset);
  const ids = rows.map((r) => r.a.id);
  const companyIds = [...new Set(rows.map((r) => r.a.companyId))];
  const [results, ests] = await Promise.all([
    ids.length ? db.select({ attemptId: callResults.attemptId, code: callResults.code }).from(callResults).where(inArray(callResults.attemptId, ids)) : [],
    companyIds.length
      ? db.select({ companyId: establishments.companyId, name: establishments.nombreComercial, rut: establishments.rut }).from(establishments).where(inArray(establishments.companyId, companyIds))
      : [],
  ]);
  const estBy = new Map<number, { name: string | null; rut: string | null }>();
  for (const e of ests) if (!estBy.has(e.companyId)) estBy.set(e.companyId, e);
  return rows.map((r) => {
    const e = estBy.get(r.a.companyId);
    const codes = r.a.noContactCode ? [r.a.noContactCode] : [...new Set(results.filter((x) => x.attemptId === r.a.id).map((x) => x.code))];
    return { ...r, name: e?.name ?? r.razonSocial ?? r.companyKey, rut: e?.rut ?? null, codes };
  });
}

// Campaigns that appear in the person's call list (agents: only those where they called).
export async function callCampaigns(me: User) {
  const ids = (await db.selectDistinct({ id: callAttempts.campaignId }).from(callAttempts).where(scope(me))).map((r) => r.id);
  return ids.length ? db.select({ id: campaigns.id, name: campaigns.name }).from(campaigns).where(inArray(campaigns.id, ids)).orderBy(desc(campaigns.startDate)) : [];
}

const reviewer = alias(users, "reviewer");

// One call with everything needed for its summary, or null when the person may not see it.
export async function callDetail(me: User, attemptId: number) {
  const [row] = await db
    .select({ a: callAttempts, agent: users.name, reviewerName: reviewer.name, campaign: campaigns.name, company: companies })
    .from(callAttempts)
    .innerJoin(users, eq(users.id, callAttempts.userId))
    .leftJoin(reviewer, eq(reviewer.id, callAttempts.reviewedBy))
    .innerJoin(campaigns, eq(campaigns.id, callAttempts.campaignId))
    .innerJoin(companies, eq(companies.id, callAttempts.companyId))
    .where(and(eq(callAttempts.id, attemptId), scope(me)));
  if (!row) return null;
  const results = await db
    .select({ r: callResults, name: establishments.nombreComercial, sigturId: establishments.sigturId, rut: establishments.rut })
    .from(callResults)
    .innerJoin(establishments, eq(establishments.id, callResults.establishmentId))
    .where(eq(callResults.attemptId, attemptId));
  const ests = await db.select({ name: establishments.nombreComercial, rut: establishments.rut }).from(establishments).where(eq(establishments.companyId, row.a.companyId)).limit(1);
  return { ...row, results, name: ests[0]?.name ?? row.company.razonSocial ?? row.company.key, rut: ests[0]?.rut ?? null };
}

export async function reviewCall(me: User, attemptId: number, comment: string | null) {
  if (!canSeeAllCalls(me)) throw new Error("Not found");
  const a = await db.query.callAttempts.findFirst({ where: eq(callAttempts.id, attemptId) });
  if (!a) throw new Error("Not found");
  await db
    .update(callAttempts)
    .set({ reviewedAt: new Date().toISOString(), reviewedBy: me.id, reviewComment: comment?.trim() ? comment.trim().slice(0, 2000) : null })
    .where(eq(callAttempts.id, attemptId));
  return a;
}
