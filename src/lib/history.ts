import "server-only";
import { and, eq, inArray, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { callAttempts, callResults, campaigns, establishments, historyArchive, users, visits } from "@/db/schema";
import { localDateOf } from "./dates";

// What happened to the same RUT (or the same company, for closures) in other campaigns:
// commitments (call 01, visit V2) and closures (call 05 / "¿En operación? No", visit V4).

export type HistoryNote = {
  kind: "commitment" | "closed";
  rut: string | null;
  establishment: string | null;
  campaignName: string;
  date: string | null;
  source: string;
  byName: string | null;
  at: string | null;
  // true when it was another RUT of the same company (same RNC)
  sameCompany: boolean;
};

const rncKey = (v: string | null | undefined) => (v ?? "").replace(/[^0-9A-Za-z]/g, "");
const rncSql = sql`replace(replace(replace(coalesce(${establishments.rnc}, ''), '-', ''), ' ', ''), '.', '')`;

type Row = Omit<HistoryNote, "sameCompany"> & { rnc: string | null; sigturId: string | null };

// Records of live campaigns matching the filter (excluding one campaign, the one being worked).
async function liveRows(match: ReturnType<typeof and>, exceptCampaignId: number | null): Promise<Row[]> {
  const notHere = exceptCampaignId ? [ne(establishments.campaignId, exceptCampaignId)] : [];
  const base = { rut: establishments.rut, rnc: establishments.rnc, sigturId: establishments.sigturId, establishment: establishments.nombreComercial, campaignName: campaigns.name };
  const [calls, vis] = await Promise.all([
    db
      .select({ ...base, code: callResults.code, enOperacion: callResults.enOperacion, commitmentDate: callResults.commitmentDate, closedSince: callResults.closedSince, at: callAttempts.calledAt, byName: users.name })
      .from(callResults)
      .innerJoin(establishments, eq(establishments.id, callResults.establishmentId))
      .innerJoin(campaigns, eq(campaigns.id, establishments.campaignId))
      .innerJoin(callAttempts, eq(callAttempts.id, callResults.attemptId))
      .leftJoin(users, eq(users.id, callAttempts.userId))
      .where(and(match, ...notHere, or(eq(callResults.code, "01"), eq(callResults.code, "05"), eq(callResults.enOperacion, "No")))),
    db
      .select({ ...base, code: visits.code, commitmentDate: visits.commitmentDate, visitDate: visits.visitDate, byName: users.name })
      .from(visits)
      .innerJoin(establishments, eq(establishments.id, visits.establishmentId))
      .innerJoin(campaigns, eq(campaigns.id, establishments.campaignId))
      .leftJoin(users, eq(users.id, visits.userId))
      .where(and(match, ...notHere, inArray(visits.code, ["V2", "V4"]))),
  ]);
  const out: Row[] = [];
  for (const c of calls) {
    const { code, enOperacion, commitmentDate, closedSince, ...rest } = c;
    if (code === "01") out.push({ ...rest, kind: "commitment", date: commitmentDate, source: `Llamada ${code}` });
    else if (code === "05" || enOperacion === "No") out.push({ ...rest, kind: "closed", date: closedSince, source: `Llamada ${code}` });
  }
  for (const v of vis) {
    const { code, commitmentDate, visitDate, ...rest } = v;
    out.push({ ...rest, kind: code === "V2" ? "commitment" : "closed", date: code === "V2" ? commitmentDate : null, source: `Visita ${code}`, at: `${visitDate}T16:00:00.000Z` });
  }
  return out;
}

async function archivedRows(ruts: string[], rncs: string[]): Promise<Row[]> {
  if (!ruts.length && !rncs.length) return [];
  const rows = await db
    .select()
    .from(historyArchive)
    .where(or(ruts.length ? inArray(historyArchive.rut, ruts) : sql`0`, rncs.length ? and(eq(historyArchive.kind, "closed"), inArray(historyArchive.rnc, rncs)) : sql`0`));
  return rows.map((r) => ({ kind: r.kind as Row["kind"], rut: r.rut, rnc: r.rnc, sigturId: r.sigturId, establishment: r.establishment, campaignName: r.campaignName, date: r.date, source: r.source ?? "", byName: r.byName, at: r.at }));
}

// Notes for the establishments of a task (and the RUTs of its same-company tasks), newest first, one per
// kind + RUT + campaign.
export async function historyFor(campaignId: number, ests: { rut: string | null; rnc: string | null }[]) {
  const ruts = [...new Set(ests.map((e) => e.rut).filter((r): r is string => !!r))];
  const rncs = [...new Set(ests.map((e) => rncKey(e.rnc)).filter((r) => r.length >= 5))];
  if (!ruts.length && !rncs.length) return [] as HistoryNote[];
  const match = or(ruts.length ? inArray(establishments.rut, ruts) : sql`0`, rncs.length ? inArray(rncSql, rncs) : sql`0`);
  const rows = [...(await liveRows(and(match), campaignId)), ...(await archivedRows(ruts, rncs))];
  const own = new Set(ruts);
  const seen = new Set<string>();
  const notes: HistoryNote[] = [];
  for (const r of rows.sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""))) {
    const sameCompany = !r.rut || !own.has(r.rut);
    // Another RUT of the same company only matters when it was found closed.
    if (sameCompany && r.kind !== "closed") continue;
    if (sameCompany && !rncs.includes(rncKey(r.rnc))) continue;
    const k = `${r.kind}|${r.rut}|${r.campaignName}`;
    if (seen.has(k)) continue;
    seen.add(k);
    notes.push({ kind: r.kind, rut: r.rut, establishment: r.establishment, campaignName: r.campaignName, date: r.date, source: r.source, byName: r.byName, at: r.at, sameCompany });
  }
  return notes;
}

// Before a campaign is deleted its commitments and closures are copied, so the warnings stay.
export async function archiveCampaignHistory(campaignId: number) {
  return archive(await liveRows(and(eq(establishments.campaignId, campaignId)), null));
}

// Same, for tasks removed from a campaign («Eliminar de la campaña»).
export async function archiveTasksHistory(companyIds: number[]) {
  let n = 0;
  for (let i = 0; i < companyIds.length; i += 500) n += await archive(await liveRows(and(inArray(establishments.companyId, companyIds.slice(i, i + 500))), null));
  return n;
}

async function archive(rows: Row[]) {
  for (let i = 0; i < rows.length; i += 200) {
    await db.insert(historyArchive).values(
      rows.slice(i, i + 200).map((r) => ({ kind: r.kind, rut: r.rut, rnc: rncKey(r.rnc) || null, sigturId: r.sigturId, establishment: r.establishment, campaignName: r.campaignName, date: r.date, source: r.source, byName: r.byName, at: r.at })),
    );
  }
  return rows.length;
}

export const historyDay = (n: HistoryNote) => (n.at ? localDateOf(n.at) : null);
