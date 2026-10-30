import "server-only";
import { and, eq, inArray, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { campaigns, companies, establishments, phones, type Campaign } from "@/db/schema";
import { codeLabel, COMPANY_STATUSES } from "./catalog";
import { MAIL_COND } from "./task-filters";

// «Nueva campaña con estas tareas»: which tasks of a running campaign move to a new one.
// mail = «¿Recibió el correo?» (yes | no | none).
export type TransferFilter = { statuses: string[]; code?: string; zone?: string; priority?: string; agent?: string; mail?: string };
export const TRANSFERABLE = ["pending", "retry", "followup", "visit", "done"];

function where(campaignId: number, f: TransferFilter): SQL {
  const statuses = f.statuses.filter((s) => TRANSFERABLE.includes(s));
  const w: SQL[] = [eq(companies.campaignId, campaignId), inArray(companies.status, statuses.length ? statuses : ["-"])];
  if (f.code) w.push(eq(companies.lastCode, f.code));
  if (f.zone) w.push(eq(companies.zone, f.zone));
  if (f.priority) w.push(eq(companies.priority, f.priority));
  if (f.agent) w.push(eq(companies.assignedUserId, Number(f.agent)));
  if (f.mail && MAIL_COND[f.mail]) w.push(MAIL_COND[f.mail]);
  return and(...w)!;
}

export async function countTransfer(campaignId: number, f: TransferFilter) {
  const rows = await db.select({ id: companies.id }).from(companies).where(where(campaignId, f));
  return rows.length;
}

function withoutId<T extends { id: number }>(row: T): Omit<T, "id"> {
  const copy: Partial<T> = { ...row };
  delete copy.id;
  return copy as Omit<T, "id">;
}

// Results of the previous campaign are cleared in the copy; the rest of the establishment's data stays.
const RESET = { finalCode: null, enOperacion: null, fechaCompromiso: null, requiereVisita: null, responsable: null, cerradoDesde: null, obstaculo: null };

// kind "email" = «Campaña de correo»: a fresh mailing (sent and bounce marks cleared, corrected emails kept),
// and the original tasks keep going.
export async function transferToNewCampaign(
  from: Campaign,
  f: TransferFilter,
  data: Pick<Campaign, "name" | "description" | "startDate" | "endDate" | "maxAttempts" | "followupDays">,
  createdBy: number,
  kind: "standard" | "email" = "standard",
) {
  const email = kind === "email";
  const tasks = await db.select().from(companies).where(where(from.id, f));
  if (!tasks.length) return null;
  const [c] = await db
    .insert(campaigns)
    .values({ ...data, kind, status: "draft", source: "transfer", sourceRef: String(from.id), scriptEs: from.scriptEs, scriptEn: from.scriptEn, createdBy })
    .returning();
  const ids = tasks.map((t) => t.id);
  const [ests, phs] = await Promise.all([
    db.select().from(establishments).where(inArray(establishments.companyId, ids)),
    db.select().from(phones).where(and(inArray(phones.companyId, ids), eq(phones.active, true))),
  ]);
  for (const t of tasks) {
    const last = t.lastCode ? codeLabel(t.lastCode, "es") : COMPANY_STATUSES[t.status]?.es ?? t.status;
    const [nc] = await db
      .insert(companies)
      .values({
        campaignId: c.id, key: t.key, razonSocial: t.razonSocial, rnc: t.rnc, priority: t.priority, zone: t.zone, status: "pending",
        originNote: `Viene de «${from.name}»: último resultado ${last}${t.attempts ? ` (${t.attempts} intento${t.attempts === 1 ? "" : "s"})` : ""}`,
      })
      .returning({ id: companies.id });
    const own = ests.filter((e) => e.companyId === t.id);
    if (own.length) {
      await db.insert(establishments).values(own.map((e) => ({ ...withoutId(e), ...RESET, ...(email ? { correoEnviadoFecha: null, correoRebotado: null } : {}), campaignId: c.id, companyId: nc.id })));
    }
    const ownPhones = phs.filter((p) => p.companyId === t.id);
    if (ownPhones.length) {
      await db.insert(phones).values(ownPhones.map((p) => ({ ...withoutId(p), replacesPhoneId: null, campaignId: c.id, companyId: nc.id })));
    }
  }
  if (email) return { campaign: c, count: tasks.length };
  // In the original campaign those tasks are closed as «Transferida», so nobody works them twice.
  for (let i = 0; i < ids.length; i += 500) {
    await db
      .update(companies)
      .set({ status: "transferred", transferredToCampaignId: c.id, nextActionAt: null, coverAbsenceId: null, coverFromUserId: null, coverUserId: null })
      .where(inArray(companies.id, ids.slice(i, i + 500)));
  }
  return { campaign: c, count: tasks.length };
}
