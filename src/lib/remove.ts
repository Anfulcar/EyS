import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { callAttempts, callResults, campaigns, companies, establishments, phones, removedTasks, statusChanges, visits } from "@/db/schema";
import { archiveTasksHistory } from "./history";
import { taskWhere, type TaskFilters } from "./task-filters";

// «Eliminar de la campaña» (administrators): the task, its establishments, phones, calls and visits are deleted
// for good. What stays: a «Eliminadas» record with the reason, a line in «Registro» and the commitments/closures
// for the warnings in later campaigns.

export const MAX_REMOVE = 5000;

export type RemovalPreview = { tasks: number; establishments: number; calls: number; visits: number; sigturOpen: number; notFound: string[]; ids: number[]; tooMany: boolean };

const chunks = <T,>(list: T[], n = 500) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));

// Only tasks of this campaign count (ids from the screen or a file are checked again here).
async function ownIds(campaignId: number, ids: number[]) {
  const out: number[] = [];
  for (const part of chunks([...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))])) {
    out.push(...(await db.select({ id: companies.id }).from(companies).where(and(eq(companies.campaignId, campaignId), inArray(companies.id, part)))).map((r) => r.id));
  }
  return out;
}

export async function idsByFilters(campaignId: number, f: TaskFilters) {
  return (await db.select({ id: companies.id }).from(companies).where(and(...taskWhere(campaignId, f)))).map((r) => r.id);
}

// The RUTs (or ID SIGTUR) of a file, matched against this campaign's establishments.
export async function idsByKeys(campaignId: number, keys: string[]) {
  const wanted = [...new Set(keys.map((k) => k.trim()).filter(Boolean))];
  const ests = await db.select({ companyId: establishments.companyId, rut: establishments.rut, sigturId: establishments.sigturId }).from(establishments).where(eq(establishments.campaignId, campaignId));
  const byKey = new Map<string, number>();
  for (const e of ests) {
    if (e.rut) byKey.set(e.rut.toUpperCase(), e.companyId);
    byKey.set(e.sigturId.toUpperCase(), e.companyId);
  }
  const ids = new Set<number>();
  const notFound: string[] = [];
  for (const k of wanted) {
    const id = byKey.get(k.toUpperCase());
    if (id) ids.add(id);
    else notFound.push(k);
  }
  return { ids: [...ids], notFound };
}

export async function previewRemoval(campaignId: number, rawIds: number[], notFound: string[] = []): Promise<RemovalPreview> {
  const ids = await ownIds(campaignId, rawIds);
  let ests = 0, calls = 0, vis = 0, open = 0;
  for (const part of chunks(ids)) {
    const [[e], [c], [v], [s]] = await Promise.all([
      db.select({ n: sql<number>`count(*)` }).from(establishments).where(inArray(establishments.companyId, part)),
      db.select({ n: sql<number>`count(*)` }).from(callAttempts).where(inArray(callAttempts.companyId, part)),
      db.select({ n: sql<number>`count(*)` }).from(visits).innerJoin(establishments, eq(establishments.id, visits.establishmentId)).where(inArray(establishments.companyId, part)),
      db.select({ n: sql<number>`count(*)` }).from(companies).where(and(inArray(companies.id, part), eq(companies.sigturRequest, true), sql`${companies.requestResolvedAt} is null`)),
    ]);
    ests += Number(e.n);
    calls += Number(c.n);
    vis += Number(v.n);
    open += Number(s.n);
  }
  return { tasks: ids.length, establishments: ests, calls, visits: vis, sigturOpen: open, notFound: notFound.slice(0, 50), ids, tooMany: ids.length > MAX_REMOVE };
}

export async function removeTasks(user: { id: number; name: string }, campaignId: number, rawIds: number[], reason: string) {
  const campaign = await db.query.campaigns.findFirst({ where: eq(campaigns.id, campaignId) });
  if (!campaign || campaign.status === "closed") return { removed: 0, closed: true };
  const ids = await ownIds(campaignId, rawIds);
  if (!ids.length || ids.length > MAX_REMOVE) return { removed: 0, tooMany: ids.length > MAX_REMOVE };
  await archiveTasksHistory(ids);
  for (const part of chunks(ids)) {
    const [tasks, ests, callCounts, visitCounts] = await Promise.all([
      db.select().from(companies).where(inArray(companies.id, part)),
      db.select().from(establishments).where(inArray(establishments.companyId, part)),
      db.select({ companyId: callAttempts.companyId, n: sql<number>`count(*)` }).from(callAttempts).where(inArray(callAttempts.companyId, part)).groupBy(callAttempts.companyId),
      db.select({ companyId: establishments.companyId, n: sql<number>`count(*)` }).from(visits).innerJoin(establishments, eq(establishments.id, visits.establishmentId)).where(inArray(establishments.companyId, part)).groupBy(establishments.companyId),
    ]);
    const callsOf = new Map(callCounts.map((r) => [r.companyId, Number(r.n)]));
    const visitsOf = new Map(visitCounts.map((r) => [r.companyId, Number(r.n)]));
    const firstEst = new Map<number, (typeof ests)[number]>();
    for (const e of ests) if (!firstEst.has(e.companyId)) firstEst.set(e.companyId, e);
    await db.insert(removedTasks).values(
      tasks.map((t) => {
        const e = firstEst.get(t.id);
        return {
          campaignId, rut: e?.rut ?? t.key.replace(/^RUT:/, ""), sigturId: e?.sigturId ?? null, establishment: e?.nombreComercial ?? t.razonSocial, rnc: t.rnc,
          lastStatus: t.status, calls: callsOf.get(t.id) ?? 0, visits: visitsOf.get(t.id) ?? 0, reason, removedBy: user.id, removedByName: user.name,
        };
      }),
    );
    // Deleted in order (results and visits first), so nothing is left behind.
    const estIds = ests.map((e) => e.id);
    if (estIds.length) {
      for (const ep of chunks(estIds)) {
        await db.delete(callResults).where(inArray(callResults.establishmentId, ep));
        await db.delete(visits).where(inArray(visits.establishmentId, ep));
        await db.delete(statusChanges).where(inArray(statusChanges.establishmentId, ep));
      }
    }
    await db.delete(callResults).where(inArray(callResults.attemptId, db.select({ id: callAttempts.id }).from(callAttempts).where(inArray(callAttempts.companyId, part))));
    await db.delete(callAttempts).where(inArray(callAttempts.companyId, part));
    await db.delete(phones).where(inArray(phones.companyId, part));
    await db.delete(establishments).where(inArray(establishments.companyId, part));
    await db.delete(companies).where(inArray(companies.id, part));
  }
  return { removed: ids.length };
}

export async function removedList(campaignId: number, limit = 2000) {
  return db.select().from(removedTasks).where(eq(removedTasks.campaignId, campaignId)).orderBy(desc(removedTasks.removedAt), desc(removedTasks.id)).limit(limit);
}

export async function removedCount(campaignId: number) {
  const [r] = await db.select({ n: sql<number>`count(*)` }).from(removedTasks).where(eq(removedTasks.campaignId, campaignId));
  return Number(r.n);
}
