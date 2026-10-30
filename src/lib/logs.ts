import "server-only";
import { and, desc, gte, inArray, like, lte, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { activityLog, errorLog } from "@/db/schema";
import { localDayEnd, localDayStart } from "./dates";
import { many, manyIds } from "./multi";

export type LogFilters = { action?: string; user?: string; q?: string; from?: string; to?: string; source?: string };

// Dates in the filters are local (UTC-4) days; stored times are UTC.
const startOf = localDayStart;
const endOf = localDayEnd;

export async function activityRows(f: LogFilters, limit: number, offset = 0) {
  const w: SQL[] = [];
  // "What" and "who" accept several choices ("a|b").
  const actions = many(f.action);
  if (actions.length) w.push(inArray(activityLog.action, actions));
  const people = manyIds(f.user);
  if (people.length) w.push(inArray(activityLog.userId, people));
  if (f.from) w.push(gte(activityLog.at, startOf(f.from)));
  if (f.to) w.push(lte(activityLog.at, endOf(f.to)));
  if (f.q) w.push(or(like(activityLog.summary, `%${f.q}%`), like(activityLog.userName, `%${f.q}%`))!);
  return db.select().from(activityLog).where(w.length ? and(...w) : undefined).orderBy(desc(activityLog.id)).limit(limit).offset(offset);
}

export async function errorRows(f: LogFilters, limit: number, offset = 0) {
  const w: SQL[] = [];
  const sources = many(f.source);
  if (sources.length) w.push(inArray(errorLog.source, sources));
  if (f.from) w.push(gte(errorLog.at, startOf(f.from)));
  if (f.to) w.push(lte(errorLog.at, endOf(f.to)));
  if (f.q) w.push(or(like(errorLog.message, `%${f.q}%`), like(errorLog.path, `%${f.q}%`))!);
  return db.select().from(errorLog).where(w.length ? and(...w) : undefined).orderBy(desc(errorLog.id)).limit(limit).offset(offset);
}
