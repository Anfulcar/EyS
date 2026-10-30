import "server-only";
import { and, desc, eq, gte, inArray, isNotNull, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { campaigns, dataChanges, establishments } from "@/db/schema";
import { localDayEnd, localDayStart, nowIso } from "./dates";
import { many, manyIds } from "./multi";
import type { DataChange } from "./sigtur-push";

// «Reporte de cambios»: every data change a person made to an establishment, to update SIGTUR by hand.

export const CHANGE_FIELDS: Record<string, { es: string; en: string }> = {
  correo: { es: "Correo", en: "Email" },
  nombreComercial: { es: "Nombre comercial", en: "Trade name" },
  direccion: { es: "Dirección", en: "Address" },
  propietario: { es: "Dueño / responsable", en: "Owner / person in charge" },
  enOperacion: { es: "¿En operación?", en: "Operating?" },
  cerradoDesde: { es: "Cerrado desde", en: "Closed since" },
};

export async function recordChanges(changes: DataChange[], by: { id: number; name: string }, source: string, at = nowIso()) {
  if (!changes.length) return;
  const ests = await db
    .select({ id: establishments.id, campaignId: establishments.campaignId, campaignName: campaigns.name, rut: establishments.rut, sigturId: establishments.sigturId, name: establishments.nombreComercial })
    .from(establishments)
    .leftJoin(campaigns, eq(campaigns.id, establishments.campaignId))
    .where(inArray(establishments.id, [...new Set(changes.map((c) => c.establishmentId))]));
  const byId = new Map(ests.map((e) => [e.id, e]));
  await db.insert(dataChanges).values(
    changes.map((c) => {
      const e = byId.get(c.establishmentId);
      return {
        establishmentId: e ? c.establishmentId : null, campaignId: e?.campaignId ?? null, campaignName: e?.campaignName ?? null, rut: e?.rut ?? null, sigturId: e?.sigturId ?? null,
        establishment: e?.name ?? null, field: c.field, label: c.label, fromValue: c.from, toValue: c.to, byUserId: by.id, byName: by.name, source, at,
      };
    }),
  );
}

export type ChangeFilters = { campaign?: string; field?: string; from?: string; to?: string; state?: string; q?: string };

function where(f: ChangeFilters): SQL | undefined {
  const w: SQL[] = [];
  const camps = manyIds(f.campaign);
  if (camps.length) w.push(inArray(dataChanges.campaignId, camps));
  const fields = many(f.field);
  if (fields.length) w.push(inArray(dataChanges.field, fields));
  if (f.from) w.push(gte(dataChanges.at, localDayStart(f.from)));
  if (f.to) w.push(lte(dataChanges.at, localDayEnd(f.to)));
  // Both states ticked = no filter.
  const state = many(f.state);
  if (state.length === 1 && state[0] === "pending") w.push(isNull(dataChanges.sigturDoneAt));
  if (state.length === 1 && state[0] === "done") w.push(isNotNull(dataChanges.sigturDoneAt));
  if (f.q) {
    const q = `%${f.q}%`;
    w.push(or(sql`${dataChanges.rut} like ${q}`, sql`${dataChanges.sigturId} like ${q}`, sql`${dataChanges.establishment} like ${q}`)!);
  }
  return w.length ? and(...w) : undefined;
}

export async function changeRows(f: ChangeFilters, limit: number, offset = 0) {
  return db.select().from(dataChanges).where(where(f)).orderBy(desc(dataChanges.at), desc(dataChanges.id)).limit(limit).offset(offset);
}

export async function changeCounts(f: ChangeFilters) {
  const [r] = await db
    .select({ total: sql<number>`count(*)`, pending: sql<number>`coalesce(sum(case when ${dataChanges.sigturDoneAt} is null then 1 else 0 end), 0)` })
    .from(dataChanges)
    .where(where(f));
  return { total: Number(r.total), pending: Number(r.pending) };
}

// After updating SIGTUR by hand. Rows already marked keep their first mark.
export async function markSigturDone(ids: number[], by: { id: number; name: string }) {
  const clean = [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))].slice(0, 5000);
  if (!clean.length) return 0;
  let n = 0;
  for (let i = 0; i < clean.length; i += 500) {
    const r = await db
      .update(dataChanges)
      .set({ sigturDoneAt: nowIso(), sigturDoneBy: by.id, sigturDoneByName: by.name })
      .where(and(inArray(dataChanges.id, clean.slice(i, i + 500)), isNull(dataChanges.sigturDoneAt)))
      .returning({ id: dataChanges.id });
    n += r.length;
  }
  return n;
}

export async function changeCampaigns() {
  return db.selectDistinct({ id: dataChanges.campaignId, name: dataChanges.campaignName }).from(dataChanges).where(isNotNull(dataChanges.campaignId)).orderBy(dataChanges.campaignName);
}

