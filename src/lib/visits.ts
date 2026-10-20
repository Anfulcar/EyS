import "server-only";
import { and, asc, eq, inArray, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { campaigns, establishments, phones, visits } from "@/db/schema";
import { visitPending } from "./workflow";

export async function pendingVisits(filters: { campaignId?: number; zone?: string; showAll?: boolean }) {
  const active = await db.select().from(campaigns).where(eq(campaigns.status, "active"));
  const ids = active.map((c) => c.id).filter((id) => !filters.campaignId || id === filters.campaignId);
  const where: SQL[] = [inArray(establishments.campaignId, ids.length ? ids : [-1]), eq(establishments.requiereVisita, "Sí")];
  if (filters.zone) where.push(eq(establishments.zonaOperativa, filters.zone));
  const ests = await db.select().from(establishments).where(and(...where)).orderBy(asc(establishments.zonaOperativa), asc(establishments.municipio), asc(establishments.direccion));
  const estIds = ests.map((e) => e.id);
  const [vis, phs] = estIds.length
    ? await Promise.all([
        db.select().from(visits).where(inArray(visits.establishmentId, estIds)).orderBy(asc(visits.visitNo)),
        db.select().from(phones).where(and(inArray(phones.companyId, [...new Set(ests.map((e) => e.companyId))]), eq(phones.active, true))),
      ])
    : [[], []];
  const visBy = new Map<number, typeof vis>();
  for (const v of vis) visBy.set(v.establishmentId, [...(visBy.get(v.establishmentId) ?? []), v]);
  const phBy = new Map<number, string[]>();
  for (const p of phs) phBy.set(p.companyId, [...(phBy.get(p.companyId) ?? []), p.number]);
  const rows = ests
    .map((e) => ({ e, visits: visBy.get(e.id) ?? [], phones: phBy.get(e.companyId) ?? [] }))
    .filter((r) => filters.showAll || visitPending(r.visits.map((v) => v.code)));
  const zones = [...new Set((await db.selectDistinct({ z: establishments.zonaOperativa }).from(establishments).where(inArray(establishments.campaignId, ids.length ? ids : [-1]))).map((x) => x.z).filter(Boolean))] as string[];
  return { rows, active, zones: zones.sort() };
}
