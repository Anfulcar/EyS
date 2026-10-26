import "server-only";
import { and, eq, gte, inArray, isNotNull, lte, ne, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { absences, campaigns, companies, establishments, users, type Company } from "@/db/schema";
import { logActivity } from "./audit";
import { CLOSED_STATUSES, PRIORITY_ORDER } from "./catalog";
import { nowIso, todayLocal } from "./dates";

export const ABSENCE_KINDS = ["vacation", "day_off", "unavailable"] as const;

// ---------- Absences ----------

// Absences that include the given day (local date), by person.
export async function absentOn(day = todayLocal()) {
  const rows = await db.select().from(absences).where(and(lte(absences.fromDate, day), gte(absences.toDate, day)));
  return new Map(rows.map((a) => [a.userId, a]));
}

// Absences that are running now or start within the next `days` days.
export async function currentAndUpcomingAbsences(days = 14, day = todayLocal()) {
  const until = new Date(new Date(`${day}T12:00:00Z`).getTime() + days * 86400000).toISOString().slice(0, 10);
  return db.select().from(absences).where(and(gte(absences.toDate, day), lte(absences.fromDate, until))).orderBy(absences.fromDate);
}

// ---------- Workload ----------

// Open work per person in every campaign that is not closed, counted by establishment.
export async function workload(userIds: number[], excludeCompanyIds: number[] = []) {
  const load = new Map(userIds.map((id) => [id, 0]));
  if (!userIds.length) return load;
  const rows = await db
    .select({ userId: companies.assignedUserId, companyId: companies.id, n: sql<number>`count(${establishments.id})` })
    .from(companies)
    .innerJoin(campaigns, eq(campaigns.id, companies.campaignId))
    .leftJoin(establishments, eq(establishments.companyId, companies.id))
    .where(and(inArray(companies.assignedUserId, userIds), notInArray(companies.status, CLOSED_STATUSES), ne(campaigns.status, "closed")))
    .groupBy(companies.id);
  const skip = new Set(excludeCompanyIds);
  for (const r of rows) if (r.userId && !skip.has(r.companyId)) load.set(r.userId, (load.get(r.userId) ?? 0) + Math.max(1, Number(r.n)));
  return load;
}

// Shares tasks evenly: tasks of the same company (RNC) stay together with one person; highest priority
// and biggest groups first, each group to the person with the lowest load (starting from `startLoad`).
export function distribute(tasks: Company[], people: number[], size: Map<number, number>, startLoad?: Map<number, number>) {
  const load = new Map(people.map((p) => [p, startLoad?.get(p) ?? 0]));
  const groups = new Map<string, Company[]>();
  for (const c of tasks) {
    const k = (c.rnc ?? "").replace(/[^0-9A-Za-z]/g, "") || `task:${c.id}`;
    groups.set(k, [...(groups.get(k) ?? []), c]);
  }
  const best = (g: Company[]) => Math.min(...g.map((c) => PRIORITY_ORDER[c.priority ?? ""] ?? 9));
  const sorted = [...groups.values()].sort((a, b) => best(a) - best(b) || b.length - a.length);
  const assignment = new Map<number, number>();
  if (!people.length) return assignment;
  for (const g of sorted) {
    const [person] = [...load.entries()].sort((a, b) => a[1] - b[1] || a[0] - b[0])[0];
    for (const c of g) assignment.set(c.id, person);
    load.set(person, load.get(person)! + g.reduce((n, c) => n + (size.get(c.id) ?? 1), 0));
  }
  return assignment;
}

export async function establishmentCounts(companyIds: number[]) {
  const size = new Map<number, number>();
  for (let i = 0; i < companyIds.length; i += 500) {
    const rows = await db
      .select({ companyId: establishments.companyId, n: sql<number>`count(*)` })
      .from(establishments)
      .where(inArray(establishments.companyId, companyIds.slice(i, i + 500)))
      .groupBy(establishments.companyId);
    for (const r of rows) size.set(r.companyId, Number(r.n));
  }
  return size;
}

async function setAssignee(assignment: Map<number, number>, extra: Partial<typeof companies.$inferInsert> = {}) {
  const byPerson = new Map<number, number[]>();
  for (const [cid, p] of assignment) byPerson.set(p, [...(byPerson.get(p) ?? []), cid]);
  for (const [p, ids] of byPerson) {
    for (let i = 0; i < ids.length; i += 500) {
      await db.update(companies).set({ assignedUserId: p, ...extra }).where(inArray(companies.id, ids.slice(i, i + 500)));
    }
  }
}

// ---------- Moving and covering tasks ----------

// Open tasks of one person in a campaign (not finished).
export async function openTasksOf(campaignId: number, userId: number) {
  return db.select().from(companies).where(and(eq(companies.campaignId, campaignId), eq(companies.assignedUserId, userId), notInArray(companies.status, CLOSED_STATUSES)));
}

// Permanent move of someone's open tasks: to one person, or shared evenly by workload.
export async function moveTasks(campaignId: number, fromUserId: number, to: number[], byWorkload = true) {
  const tasks = await openTasksOf(campaignId, fromUserId);
  const people = to.filter((p) => p !== fromUserId);
  if (!tasks.length || !people.length) return 0;
  const size = await establishmentCounts(tasks.map((t) => t.id));
  const assignment = distribute(tasks, people, size, byWorkload ? await workload(people) : undefined);
  await setAssignee(assignment, { assignedAt: nowIso(), coverFromUserId: null, coverUserId: null, coverAbsenceId: null });
  return assignment.size;
}

// Temporary cover during an absence: who covers each task is saved now; the task moves on the first
// absent day and goes back to its owner after the last one (see syncCoverage).
export async function coverTasks(campaignId: number, absenceId: number, to: number[], byWorkload = true) {
  const absence = await db.query.absences.findFirst({ where: eq(absences.id, absenceId) });
  if (!absence) return 0;
  const tasks = (await openTasksOf(campaignId, absence.userId)).filter((t) => !t.coverAbsenceId);
  const people = to.filter((p) => p !== absence.userId);
  if (!tasks.length || !people.length) return 0;
  const size = await establishmentCounts(tasks.map((t) => t.id));
  const assignment = distribute(tasks, people, size, byWorkload ? await workload(people) : undefined);
  const byPerson = new Map<number, number[]>();
  for (const [cid, p] of assignment) byPerson.set(p, [...(byPerson.get(p) ?? []), cid]);
  for (const [p, ids] of byPerson) {
    for (let i = 0; i < ids.length; i += 500) {
      await db
        .update(companies)
        .set({ coverFromUserId: absence.userId, coverUserId: p, coverAbsenceId: absence.id })
        .where(inArray(companies.id, ids.slice(i, i + 500)));
    }
  }
  lastSync = 0;
  await syncCoverage();
  return assignment.size;
}

let lastSync = 0;
let lastSyncDay = "";

// Starts and ends covers according to today's date. Cheap; runs at most every 5 minutes per server
// (and right away after absences or covers change).
export async function syncCoverage(day = todayLocal(), force = false) {
  if (!force && day === lastSyncDay && Date.now() - lastSync < 5 * 60_000) return;
  lastSync = Date.now();
  lastSyncDay = day;
  // Counted first, so the app's own decision is recorded in «Registro» (per person).
  const starting = await db.all<{ uid: number; n: number }>(sql`
    select cover_from_user_id as uid, count(*) as n from companies
    where cover_absence_id in (select id from absences where from_date <= ${day} and to_date >= ${day})
      and assigned_user_id is not cover_user_id and assigned_user_id is cover_from_user_id
    group by cover_from_user_id`);
  const returning = await db.all<{ uid: number; n: number }>(sql`
    select cover_from_user_id as uid, count(*) as n from companies
    where cover_absence_id is not null
      and cover_absence_id not in (select id from absences where to_date >= ${day})
      and campaign_id in (select id from campaigns where status <> 'closed')
      and assigned_user_id is not cover_from_user_id
    group by cover_from_user_id`);
  // Absence running: the covering person works the task.
  await db.run(sql`
    update companies set assigned_user_id = cover_user_id
    where cover_absence_id in (select id from absences where from_date <= ${day} and to_date >= ${day})
      and assigned_user_id is not cover_user_id and assigned_user_id is cover_from_user_id`);
  // Absence over or deleted: back to the owner if the campaign is still open; the cover ends either way.
  await db.run(sql`
    update companies set assigned_user_id = cover_from_user_id
    where cover_absence_id is not null
      and cover_absence_id not in (select id from absences where to_date >= ${day})
      and campaign_id in (select id from campaigns where status <> 'closed')`);
  await db.run(sql`
    update companies set cover_from_user_id = null, cover_user_id = null, cover_absence_id = null
    where cover_absence_id is not null and cover_absence_id not in (select id from absences where to_date >= ${day})`);
  if (starting.length || returning.length) {
    const names = new Map((await db.select({ id: users.id, name: users.name }).from(users)).map((u) => [u.id, u.name]));
    for (const r of starting) await logActivity(null, "task.cover_started", { entity: "user", entityId: r.uid, summary: `${Number(r.n)} tareas de ${names.get(r.uid) ?? r.uid} pasan a quien cubre` });
    for (const r of returning) await logActivity(null, "task.cover_returned", { entity: "user", entityId: r.uid, summary: `${Number(r.n)} tareas → ${names.get(r.uid) ?? r.uid}` });
  }
}

export function resetSyncThrottle() {
  lastSync = 0;
}

// Tasks currently covered (for the "Cubriendo a …" tag).
export async function coveredCount(campaignId: number) {
  const rows = await db
    .select({ from: companies.coverFromUserId, n: sql<number>`count(*)` })
    .from(companies)
    .where(and(eq(companies.campaignId, campaignId), isNotNull(companies.coverAbsenceId)))
    .groupBy(companies.coverFromUserId);
  return new Map(rows.map((r) => [r.from!, Number(r.n)]));
}
