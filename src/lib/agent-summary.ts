import "server-only";
import { and, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { callAttempts, callResults, companies } from "@/db/schema";
import { CLOSED_STATUSES } from "./catalog";
import { localDateOf, localDayEnd, localDayStart, nowIso, todayLocal } from "./dates";
import { dueCondition } from "./queue";

// «Resumen del agente»: the same rules as «Estadísticas» → «Por agente», for one person.
// Tasks are counted as they are now; calls, contacts, commitments and results follow the «Desde / Hasta» period.
export type AgentScope = { campaignId?: number; from?: string; to?: string };

export async function agentSummary(userId: number, s: AgentScope) {
  const taskW: SQL[] = [eq(companies.assignedUserId, userId)];
  if (s.campaignId) taskW.push(eq(companies.campaignId, s.campaignId));
  const callW: SQL[] = [eq(callAttempts.userId, userId)];
  if (s.campaignId) callW.push(eq(callAttempts.campaignId, s.campaignId));
  if (s.from) callW.push(gte(callAttempts.calledAt, localDayStart(s.from)));
  if (s.to) callW.push(lte(callAttempts.calledAt, localDayEnd(s.to)));
  const n = (cond: SQL) => sql<number>`coalesce(sum(case when ${cond} then 1 else 0 end), 0)`;

  const [[tasks], attempts] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)`,
        done: n(sql`${companies.status} in ('done', 'visit', 'transferred')`),
        open: n(sql`${companies.status} not in (${sql.join(CLOSED_STATUSES.map((x) => sql`${x}`), sql`, `)})`),
        due: n(dueCondition(nowIso())),
      })
      .from(companies)
      .where(and(...taskW)),
    db
      .select({ id: callAttempts.id, calledAt: callAttempts.calledAt, contacted: callAttempts.contacted, attended: callAttempts.attended, noContactCode: callAttempts.noContactCode, reviewedAt: callAttempts.reviewedAt })
      .from(callAttempts)
      .where(and(...callW)),
  ]);
  const ids = attempts.map((a) => a.id);
  const results: { attemptId: number; code: string }[] = [];
  for (let i = 0; i < ids.length; i += 500) {
    results.push(...(await db.select({ attemptId: callResults.attemptId, code: callResults.code }).from(callResults).where(inArray(callResults.attemptId, ids.slice(i, i + 500)))));
  }
  const today = todayLocal();
  const isContact = (a: (typeof attempts)[number]) => a.contacted && a.attended !== false;
  const commitmentCalls = new Set(results.filter((r) => r.code === "01").map((r) => r.attemptId));

  // Result of each call (no-contact code, or each establishment's result once per call).
  const codeCount = new Map<string, number>();
  const codesOf = new Map<number, Set<string>>();
  for (const r of results) codesOf.set(r.attemptId, (codesOf.get(r.attemptId) ?? new Set()).add(r.code));
  for (const a of attempts) {
    const codes = a.noContactCode ? [a.noContactCode] : [...(codesOf.get(a.id) ?? [])];
    for (const c of codes) codeCount.set(c, (codeCount.get(c) ?? 0) + 1);
  }
  const dayMap = new Map<string, { day: string; calls: number; contacts: number }>();
  for (const a of attempts) {
    const day = localDateOf(a.calledAt);
    const d = dayMap.get(day) ?? { day, calls: 0, contacts: 0 };
    d.calls++;
    if (isContact(a)) d.contacts++;
    dayMap.set(day, d);
  }

  return {
    tasks: Number(tasks.total),
    done: Number(tasks.done),
    open: Number(tasks.open),
    dueToday: Number(tasks.due),
    calls: attempts.length,
    callsToday: attempts.filter((a) => localDateOf(a.calledAt) === today).length,
    contacts: attempts.filter(isContact).length,
    commitments: commitmentCalls.size,
    notReviewed: attempts.filter((a) => !a.reviewedAt).length,
    byCode: [...codeCount.entries()].map(([code, n]) => ({ code, n })).sort((a, b) => b.n - a.n),
    byDay: [...dayMap.values()].sort((a, b) => a.day.localeCompare(b.day)).slice(-31),
  };
}
