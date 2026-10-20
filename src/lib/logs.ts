import "server-only";
import { and, desc, eq, gte, like, lte, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { activityLog, errorLog } from "@/db/schema";

export type LogFilters = { action?: string; user?: string; q?: string; from?: string; to?: string; source?: string };

// Dates in the filters are local (UTC-4) days; stored times are UTC.
const startOf = (d: string) => new Date(`${d}T04:00:00Z`).toISOString();
const endOf = (d: string) => new Date(new Date(`${d}T04:00:00Z`).getTime() + 86400000 - 1).toISOString();

export async function activityRows(f: LogFilters, limit: number, offset = 0) {
  const w: SQL[] = [];
  if (f.action) w.push(eq(activityLog.action, f.action));
  if (f.user) w.push(eq(activityLog.userId, Number(f.user)));
  if (f.from) w.push(gte(activityLog.at, startOf(f.from)));
  if (f.to) w.push(lte(activityLog.at, endOf(f.to)));
  if (f.q) w.push(or(like(activityLog.summary, `%${f.q}%`), like(activityLog.userName, `%${f.q}%`))!);
  return db.select().from(activityLog).where(w.length ? and(...w) : undefined).orderBy(desc(activityLog.id)).limit(limit).offset(offset);
}

export async function errorRows(f: LogFilters, limit: number, offset = 0) {
  const w: SQL[] = [];
  if (f.source) w.push(eq(errorLog.source, f.source));
  if (f.from) w.push(gte(errorLog.at, startOf(f.from)));
  if (f.to) w.push(lte(errorLog.at, endOf(f.to)));
  if (f.q) w.push(or(like(errorLog.message, `%${f.q}%`), like(errorLog.path, `%${f.q}%`))!);
  return db.select().from(errorLog).where(w.length ? and(...w) : undefined).orderBy(desc(errorLog.id)).limit(limit).offset(offset);
}
