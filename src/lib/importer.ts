import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { companies, establishments, phones } from "@/db/schema";
import { MATRIX_COLUMNS, parseCode, PRIORITY_ORDER } from "./catalog";
import { toIsoDate } from "./dates";
import { digits, formatPhone, mapMatrixHeaders, normalizePhone, normHeader, type Row, splitPhones, str } from "./sheets";

type EstRecord = Record<string, string | number | null> & { sigturId: string };

const TRACKING_FIELDS = new Set([
  "correoEnviadoFecha", "correoRebotado", "finalCode", "enOperacion", "fechaCompromiso", "requiereVisita",
  "estatusSigturActualizado", "fechaCambioEstatus", "canalLogro", "responsable", "observaciones",
]);

export function buildRecords(headers: string[], rows: Row[]) {
  const { mapping, ignored, missing } = mapMatrixHeaders(headers);
  const colByHeader = new Map(MATRIX_COLUMNS.map((c) => [c.header, c]));
  const records = new Map<string, EstRecord>();
  const errors: { row: number; message: string }[] = [];
  const duplicates: string[] = [];
  rows.forEach((row, i) => {
    const rec: Record<string, string | number | null> = {};
    const extra: Record<string, unknown> = {};
    for (const [fileHeader, value] of Object.entries(row)) {
      const target = mapping[fileHeader];
      const col = target ? colByHeader.get(target) : undefined;
      if (!col?.field) {
        if (value != null && value !== "" && !target) extra[fileHeader] = value instanceof Date ? value.toISOString().slice(0, 10) : value;
        continue;
      }
      let v: string | number | null;
      if (col.kind === "date") v = toIsoDate(value);
      else if (col.kind === "int") {
        const n = Number(value);
        v = value == null || value === "" || isNaN(n) ? null : Math.round(n);
      } else v = str(value);
      if (col.field === "finalCode") v = parseCode(v);
      rec[col.field] = v;
    }
    const id = rec.sigturId != null ? String(rec.sigturId).replace(/\.0$/, "") : null;
    if (!id) {
      if (Object.values(rec).some((x) => x != null)) errors.push({ row: i + 2, message: "ID SIGTUR vacío" });
      return;
    }
    if (!rec.nombreComercial && !rec.razonSocial) {
      errors.push({ row: i + 2, message: "Sin nombre comercial ni razón social" });
      return;
    }
    if (records.has(id)) duplicates.push(id);
    rec.sigturId = id;
    if (Object.keys(extra).length) rec.extra = JSON.stringify(extra);
    records.set(id, rec as EstRecord);
  });
  return { records: [...records.values()], mapping, ignored, missing, errors, duplicates };
}

export function companyKey(r: EstRecord) {
  const rnc = digits(String(r.rnc ?? ""));
  if (rnc.length >= 5) return `RNC:${rnc}`;
  const rs = r.razonSocial ? normHeader(String(r.razonSocial)) : "";
  if (rs) return `RS:${rs}`;
  const p = splitPhones(r.telefono as string | null)[0];
  if (p) return `TEL:${normalizePhone(p)}`;
  return `ID:${r.sigturId}`;
}

function chunks<T>(arr: T[], n: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

export async function previewImport(campaignId: number, records: EstRecord[]) {
  const existing = await db
    .select({ sigturId: establishments.sigturId })
    .from(establishments)
    .where(eq(establishments.campaignId, campaignId));
  const set = new Set(existing.map((e) => e.sigturId));
  const toUpdate = records.filter((r) => set.has(r.sigturId)).length;
  const companiesCount = new Set(records.map(companyKey)).size;
  return { toInsert: records.length - toUpdate, toUpdate, companies: companiesCount };
}

export async function commitImport(campaignId: number, records: EstRecord[], mappedFields: Set<string>) {
  // 1. Companies
  const existingCompanies = await db
    .select({ id: companies.id, key: companies.key })
    .from(companies)
    .where(eq(companies.campaignId, campaignId));
  const companyIds = new Map(existingCompanies.map((c) => [c.key, c.id]));
  const keyOf = new Map(records.map((r) => [r.sigturId, companyKey(r)]));
  const newKeys = [...new Set(keyOf.values())].filter((k) => !companyIds.has(k));
  const firstByKey = new Map<string, EstRecord>();
  for (const r of records) if (!firstByKey.has(keyOf.get(r.sigturId)!)) firstByKey.set(keyOf.get(r.sigturId)!, r);
  for (const part of chunks(newKeys, 200)) {
    const inserted = await db
      .insert(companies)
      .values(part.map((k) => ({ campaignId, key: k, razonSocial: (firstByKey.get(k)?.razonSocial as string) ?? null, rnc: (firstByKey.get(k)?.rnc as string) ?? null })))
      .returning({ id: companies.id, key: companies.key });
    for (const c of inserted) companyIds.set(c.key, c.id);
  }

  // 2. Establishments
  const existingEst = await db
    .select({ id: establishments.id, sigturId: establishments.sigturId })
    .from(establishments)
    .where(eq(establishments.campaignId, campaignId));
  const estIds = new Map(existingEst.map((e) => [e.sigturId, e.id]));
  const fields = MATRIX_COLUMNS.filter((c) => c.field && mappedFields.has(c.field)).map((c) => c.field!);
  const toInsert: (typeof establishments.$inferInsert)[] = [];
  const updates: { id: number; set: Partial<typeof establishments.$inferInsert> }[] = [];
  for (const r of records) {
    const companyId = companyIds.get(keyOf.get(r.sigturId)!)!;
    const set: Record<string, unknown> = { companyId };
    for (const f of fields) {
      // Never wipe tracking data that the team already filled in with an empty cell from the file.
      if (TRACKING_FIELDS.has(f) && (r[f] == null || r[f] === "")) continue;
      set[f] = r[f] ?? null;
    }
    if (r.extra) set.extra = r.extra;
    const id = estIds.get(r.sigturId);
    if (id) updates.push({ id, set: set as Partial<typeof establishments.$inferInsert> });
    else toInsert.push({ ...(set as object), campaignId, sigturId: r.sigturId } as typeof establishments.$inferInsert);
  }
  for (const part of chunks(toInsert, 50)) await db.insert(establishments).values(part);
  for (const part of chunks(updates, 100)) {
    const stmts = part.map((u) => db.update(establishments).set(u.set).where(eq(establishments.id, u.id)));
    if (stmts.length) await db.batch(stmts as [typeof stmts[0], ...typeof stmts]);
  }

  // 3. Phones and company summary for touched companies
  const touched = [...new Set(records.map((r) => companyIds.get(keyOf.get(r.sigturId)!)!))];
  await refreshCompanies(campaignId, touched);
  return { inserted: toInsert.length, updated: updates.length, companies: touched.length };
}

export async function refreshCompanies(campaignId: number, companyIdList: number[]) {
  for (const part of chunks(companyIdList, 300)) {
    const ests = await db
      .select({
        companyId: establishments.companyId,
        telefono: establishments.telefono,
        telefonoValido: establishments.telefonoValido,
        prioridad: establishments.prioridad,
        zona: establishments.zonaOperativa,
        razonSocial: establishments.razonSocial,
        rnc: establishments.rnc,
      })
      .from(establishments)
      .where(and(eq(establishments.campaignId, campaignId), inArray(establishments.companyId, part)));
    const existingPhones = await db
      .select({ companyId: phones.companyId, normalized: phones.normalized })
      .from(phones)
      .where(and(eq(phones.campaignId, campaignId), inArray(phones.companyId, part)));
    const have = new Set(existingPhones.map((p) => `${p.companyId}|${p.normalized}`));
    const newPhones: (typeof phones.$inferInsert)[] = [];
    type Summary = { pr?: string; zones: Map<string, number>; rs?: string; rnc?: string };
    const summary = new Map<number, Summary>();
    for (const e of ests) {
      for (const p of splitPhones(e.telefono)) {
        const n = normalizePhone(p);
        const k = `${e.companyId}|${n}`;
        if (have.has(k)) continue;
        have.add(k);
        newPhones.push({
          campaignId, companyId: e.companyId, number: formatPhone(p), normalized: n, source: "file", kind: "original",
          quality: e.telefonoValido === "No" ? "invalid" : "ok",
        });
      }
      const s: Summary = summary.get(e.companyId) ?? { zones: new Map() };
      if (e.prioridad && (!s.pr || (PRIORITY_ORDER[e.prioridad] ?? 9) < (PRIORITY_ORDER[s.pr] ?? 9))) s.pr = e.prioridad;
      if (e.zona) s.zones.set(e.zona, (s.zones.get(e.zona) ?? 0) + 1);
      s.rs ??= e.razonSocial ?? undefined;
      s.rnc ??= e.rnc ?? undefined;
      summary.set(e.companyId, s);
    }
    for (const p of chunks(newPhones, 100)) await db.insert(phones).values(p);
    const stmts = [...summary.entries()].map(([id, s]) =>
      db
        .update(companies)
        .set({
          priority: s.pr ?? null,
          zone: [...s.zones.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
          razonSocial: s.rs ?? null,
          rnc: s.rnc ?? null,
        })
        .where(eq(companies.id, id)),
    );
    for (const c of chunks(stmts, 100)) if (c.length) await db.batch(c as [typeof c[0], ...typeof c]);
  }
}
