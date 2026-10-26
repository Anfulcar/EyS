import "server-only";
import { and, eq, isNotNull, isNull, like, lt, notInArray, or, sql, type SQL } from "drizzle-orm";
import { companies } from "@/db/schema";
import { CLOSED_STATUSES } from "./catalog";
import { nowIso } from "./dates";
import { dueCondition } from "./queue";

// The filters of «Tareas y asignación» (also used to remove "all filtered" tasks, so both always match).
export type TaskFilters = Record<string, string | undefined>;
export const TASK_FILTER_KEYS = ["q", "status", "agent", "zone", "f", "days", "rnt", "sub", "prio", "code"] as const;

const OP_CLOSED_SQL = sql`(case when e.en_operacion = 'No' or e.final_code = '05' or e.estatus_sigtur_actualizado = 'Inactivo (depurado)' then 1 else 0 end)`;
const OP: Record<string, SQL> = {
  opYes: sql`e.en_operacion = 'Sí' and ${OP_CLOSED_SQL} = 0`,
  opNo: sql`${OP_CLOSED_SQL} = 1`,
  opUnknown: sql`e.en_operacion = 'No sabe' and ${OP_CLOSED_SQL} = 0`,
  opNone: sql`e.en_operacion is null and ${OP_CLOSED_SQL} = 0`,
};
const anyEst = (cond: SQL) => sql`exists (select 1 from establishments e where e.company_id = ${companies.id} and ${cond})`;

export function cleanTaskFilters(v: unknown): TaskFilters {
  const o = (v ?? {}) as Record<string, unknown>;
  return Object.fromEntries(TASK_FILTER_KEYS.map((k) => [k, typeof o[k] === "string" && o[k] ? String(o[k]).slice(0, 200) : undefined]));
}

export function taskWhere(campaignId: number, sp: TaskFilters): SQL[] {
  const where: SQL[] = [eq(companies.campaignId, campaignId)];
  if (sp.status) where.push(eq(companies.status, sp.status));
  if (sp.agent === "none") where.push(isNull(companies.assignedUserId));
  else if (sp.agent) where.push(eq(companies.assignedUserId, Number(sp.agent)));
  if (sp.zone) where.push(eq(companies.zone, sp.zone));
  if (sp.prio) where.push(eq(companies.priority, sp.prio));
  if (sp.code) where.push(eq(companies.lastCode, sp.code));
  if (sp.rnt) where.push(anyEst(sql`e.estatus_rnt = ${sp.rnt}`));
  if (sp.sub) where.push(anyEst(sql`e.subsector = ${sp.sub}`));
  // Follow-up filters (also opened from the "Seguimiento" tab)
  const now = nowIso();
  const idleDays = Math.max(1, Number(sp.days) || 3);
  if (sp.f === "due") where.push(dueCondition(now));
  if (sp.f === "overdue") where.push(and(eq(companies.status, "followup"), lt(companies.nextActionAt, now))!);
  if (sp.f === "idle") where.push(and(notInArray(companies.status, CLOSED_STATUSES), lt(sql`coalesce(${companies.lastCalledAt}, ${companies.assignedAt}, '')`, new Date(Date.now() - idleDays * 86400000).toISOString()))!);
  if (sp.f === "open") where.push(notInArray(companies.status, CLOSED_STATUSES));
  if (sp.f === "covered") where.push(isNotNull(companies.coverAbsenceId));
  if (sp.f === "sigturOverdue") where.push(and(eq(companies.sigturRequest, true), isNull(companies.requestResolvedAt), isNotNull(companies.requestOverdueAt))!);
  // Operating status of any of the task's establishments (same rule as the dashboards).
  if (sp.f && OP[sp.f]) where.push(anyEst(OP[sp.f]));
  if (sp.q) {
    const q = `%${sp.q}%`;
    where.push(or(like(companies.razonSocial, q), like(companies.rnc, q), anyEst(sql`(e.nombre_comercial like ${q} or e.sigtur_id like ${q} or e.rut like ${q})`))!);
  }
  return where;
}
