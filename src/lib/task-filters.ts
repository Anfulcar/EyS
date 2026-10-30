import "server-only";
import { and, eq, inArray, isNotNull, isNull, like, lt, notInArray, or, sql, type SQL } from "drizzle-orm";
import { companies } from "@/db/schema";
import { CLOSED_STATUSES } from "./catalog";
import { nowIso } from "./dates";
import { many } from "./multi";
import { dueCondition } from "./queue";

// The filters of «Tareas y asignación» (also used to remove "all filtered" tasks, so both always match).
export type TaskFilters = Record<string, string | undefined>;
export const TASK_FILTER_KEYS = ["q", "status", "agent", "zone", "f", "days", "rnt", "sub", "prio", "code", "mail"] as const;

const OP_CLOSED_SQL = sql`(case when e.en_operacion = 'No' or e.final_code = '05' or e.estatus_sigtur_actualizado = 'Inactivo (depurado)' then 1 else 0 end)`;
const OP: Record<string, SQL> = {
  opYes: sql`e.en_operacion = 'Sí' and ${OP_CLOSED_SQL} = 0`,
  opNo: sql`${OP_CLOSED_SQL} = 1`,
  opUnknown: sql`e.en_operacion = 'No sabe' and ${OP_CLOSED_SQL} = 0`,
  opNone: sql`e.en_operacion is null and ${OP_CLOSED_SQL} = 0`,
};
const anyEst = (cond: SQL) => sql`exists (select 1 from establishments e where e.company_id = ${companies.id} and ${cond})`;

export const MAIL_COND: Record<string, SQL> = {
  yes: anyEst(sql`e.correo_recibido = 'Sí'`),
  no: anyEst(sql`e.correo_recibido = 'No'`),
  none: sql`not exists (select 1 from establishments e where e.company_id = ${companies.id} and e.correo_recibido is not null)`,
};

export function cleanTaskFilters(v: unknown): TaskFilters {
  const o = (v ?? {}) as Record<string, unknown>;
  return Object.fromEntries(TASK_FILTER_KEYS.map((k) => [k, typeof o[k] === "string" && o[k] ? String(o[k]).slice(0, 2000) : undefined]));
}

// Each filter can hold several choices ("a|b"): a task matches when it meets any of them; different filters all apply.
export function taskWhere(campaignId: number, sp: TaskFilters): SQL[] {
  const where: SQL[] = [eq(companies.campaignId, campaignId)];
  const status = many(sp.status);
  if (status.length) where.push(inArray(companies.status, status));
  const agents = many(sp.agent);
  if (agents.length) {
    const ids = agents.map(Number).filter((n) => Number.isInteger(n) && n > 0);
    const any = [...(agents.includes("none") ? [isNull(companies.assignedUserId)] : []), ...(ids.length ? [inArray(companies.assignedUserId, ids)] : [])];
    where.push(any.length ? or(...any)! : sql`0`);
  }
  const zones = many(sp.zone);
  if (zones.length) where.push(inArray(companies.zone, zones));
  const prios = many(sp.prio);
  if (prios.length) where.push(inArray(companies.priority, prios));
  const codes = many(sp.code);
  if (codes.length) where.push(inArray(companies.lastCode, codes));
  const rnts = many(sp.rnt);
  if (rnts.length) where.push(anyEst(sql`e.estatus_rnt in (${sql.join(rnts.map((v) => sql`${v}`), sql`, `)})`));
  const subs = many(sp.sub);
  if (subs.length) where.push(anyEst(sql`e.subsector in (${sql.join(subs.map((v) => sql`${v}`), sql`, `)})`));
  // «¿Recibió el correo?» of any of the task's establishments: yes / no / none (never asked).
  const mail = many(sp.mail).filter((v) => MAIL_COND[v]);
  if (mail.length) where.push(or(...mail.map((v) => MAIL_COND[v]))!);
  // Follow-up filters (also opened from the "Seguimiento" tab) and operating status of any establishment.
  const now = nowIso();
  const idleDays = Math.max(1, Number(sp.days) || 3);
  const follow: Record<string, () => SQL> = {
    due: () => dueCondition(now),
    overdue: () => and(eq(companies.status, "followup"), lt(companies.nextActionAt, now))!,
    idle: () => and(notInArray(companies.status, CLOSED_STATUSES), lt(sql`coalesce(${companies.lastCalledAt}, ${companies.assignedAt}, '')`, new Date(Date.now() - idleDays * 86400000).toISOString()))!,
    open: () => notInArray(companies.status, CLOSED_STATUSES),
    covered: () => isNotNull(companies.coverAbsenceId),
    sigturOverdue: () => and(eq(companies.sigturRequest, true), isNull(companies.requestResolvedAt), isNotNull(companies.requestOverdueAt))!,
    ...Object.fromEntries(Object.entries(OP).map(([k, cond]) => [k, () => anyEst(cond)])),
  };
  const fs = many(sp.f).filter((k) => follow[k]);
  if (fs.length) where.push(or(...fs.map((k) => follow[k]()))!);
  if (sp.q) {
    const q = `%${sp.q}%`;
    where.push(or(like(companies.razonSocial, q), like(companies.rnc, q), anyEst(sql`(e.nombre_comercial like ${q} or e.sigtur_id like ${q} or e.rut like ${q})`))!);
  }
  return where;
}
