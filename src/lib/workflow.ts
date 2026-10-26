import "server-only";
import { and, count, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { callAttempts, callResults, campaigns, companies, establishments, phones, statusChanges, visits, type User } from "@/db/schema";
import { CONTACT_CODES } from "./catalog";
import { addBusinessDays, addHours, businessDayStart, nowIso, todayLocal } from "./dates";
import { normalizePhone } from "./sheets";
import type { DataChange } from "./sigtur-push";

export type EstResultInput = {
  establishmentId: number;
  code: string;
  enOperacion?: string | null;
  commitmentDate?: string | null;
  closedSince?: string | null;
  obstacle?: string | null;
  needsVisit?: boolean;
  notes?: string | null;
  // «Actualizar datos» (result 06): what the person on the phone reported.
  newName?: string | null;
  newAddress?: string | null;
  newOwner?: string | null;
};

export type CallInput = {
  companyId: number;
  phoneId: number | null;
  // Number dialed as text: used when the call is shared with sibling tasks that don't own phoneId.
  phoneNumber?: string | null;
  // Sibling tasks (same RNC) worked in the same call.
  relatedCompanyIds?: number[];
  calledAt: string;
  contacted: boolean;
  attended: boolean | null;
  noContactCode: string | null;
  spokeWith: string | null;
  spokeRole: string | null;
  isResponsible: boolean | null;
  whatsappSent: boolean;
  updatedEmail: string | null;
  notes: string | null;
  results: EstResultInput[];
};

const RESOLVED_STATUSES = ["En proceso", "Vigente", "Inactivo (depurado)"];

export async function canWorkCompany(user: User, companyId: number) {
  const c = await db.query.companies.findFirst({ where: eq(companies.id, companyId) });
  return c && mayWork(user, c) ? c : null;
}

// Administrators and supervisors work any task; agents only the ones assigned to them.
export function mayWork(user: User, c: { assignedUserId: number | null }) {
  return user.role === "admin" || user.role === "supervisor" || (user.role === "agent" && c.assignedUserId === user.id);
}

// What a call changed, for the log and for SIGTUR (only changes a person decided).
export type CallOutcome = { attemptId: number; companyId: number; key: string; campaignId: number; toVisit: boolean; followupAt: string | null; answered: boolean; result: string; changes: DataChange[] };

const PHONE_MARK: Record<string, string> = { "07": "Equivocado", "09": "Fuera de servicio / no existe" };

// `checked` is the task already loaded and permission-checked by the caller (saves a lookup).
export async function logCall(user: User, input: CallInput, checked?: typeof companies.$inferSelect) {
  const company = checked && checked.id === input.companyId && mayWork(user, checked) ? checked : await canWorkCompany(user, input.companyId);
  if (!company) throw new Error("Not found");
  const [campaignRow, ests, allPhones] = await Promise.all([
    db.query.campaigns.findFirst({ where: eq(campaigns.id, company.campaignId) }),
    db.select().from(establishments).where(eq(establishments.companyId, company.id)),
    db.select().from(phones).where(eq(phones.companyId, company.id)),
  ]);
  const campaign = campaignRow!;
  const phone = input.phoneId ? allPhones.find((p) => p.id === input.phoneId) ?? null : null;

  const failed = !input.contacted || input.attended === false;
  const failCode = input.contacted ? "10" : input.noContactCode ?? "08";
  const now = nowIso();
  const today = todayLocal();
  const attemptNo = company.attempts + 1;

  const [attempt] = await db
    .insert(callAttempts)
    .values({
      campaignId: company.campaignId,
      companyId: company.id,
      userId: user.id,
      phoneId: phone?.id ?? null,
      phoneNumber: phone?.number ?? input.phoneNumber ?? null,
      calledAt: input.calledAt || now,
      attemptNo,
      contacted: input.contacted,
      attended: input.contacted ? input.attended : null,
      noContactCode: failed ? failCode : null,
      spokeWith: input.spokeWith,
      spokeRole: input.spokeRole,
      isResponsible: input.isResponsible,
      whatsappSent: input.whatsappSent,
      notes: input.notes,
    })
    .returning();

  const contactCodes = new Set<string>(CONTACT_CODES);
  const ops = [];
  const changes: DataChange[] = [];
  let toVisitOut = false;
  let followupOut: string | null = null;

  if (failed) {
    // A wrong / dead number is flagged on this task (matched by number, so it also works for shared calls).
    const dialed = phone?.normalized ?? (input.phoneNumber ? normalizePhone(input.phoneNumber) : null);
    const badNumber = (failCode === "07" || failCode === "09") && dialed ? dialed : null;
    if (badNumber) {
      const shown = allPhones.find((p) => p.normalized === badNumber)?.number ?? input.phoneNumber ?? badNumber;
      if (ests[0]) changes.push({ establishmentId: ests[0].id, field: "telefono", label: `Teléfono ${shown}`, from: "Válido", to: PHONE_MARK[failCode] });
      ops.push(
        db
          .update(phones)
          .set({ quality: failCode === "07" ? "wrong" : "out_of_service" })
          .where(and(eq(phones.companyId, company.id), eq(phones.normalized, badNumber))),
      );
    }
    const usable = allPhones.filter((p) => p.active && p.normalized !== badNumber && (p.quality === "ok" || p.quality === "invalid"));
    const failedAttempts = company.failedAttempts + 1;
    const toVisit = usable.length === 0 || failedAttempts >= campaign.maxAttempts;
    toVisitOut = toVisit && company.status !== "visit";
    for (const e of ests) {
      ops.push(db.insert(callResults).values({ attemptId: attempt.id, campaignId: company.campaignId, establishmentId: e.id, code: failCode, notes: null }));
      const keepContactResult = e.finalCode && contactCodes.has(e.finalCode);
      ops.push(
        db
          .update(establishments)
          .set({
            finalCode: keepContactResult ? e.finalCode : failCode,
            requiereVisita: toVisit && !keepContactResult ? "Sí" : e.requiereVisita,
            responsable: user.name,
          })
          .where(eq(establishments.id, e.id)),
      );
    }
    ops.push(
      db
        .update(companies)
        .set({
          attempts: attemptNo,
          failedAttempts,
          lastCalledAt: input.calledAt || now,
          lastCode: failCode,
          status: toVisit ? "visit" : "retry",
          nextActionAt: toVisit ? null : failCode === "10" ? addHours(now, 3) : businessDayStart(addBusinessDays(today, 1)),
          whatsappSuggested: !toVisit && failedAttempts >= 2 && !input.whatsappSent,
        })
        .where(eq(companies.id, company.id)),
    );
  } else {
    const byId = new Map(input.results.map((r) => [r.establishmentId, r]));
    let nextFollow: string | null = null;
    let anyVisit = false;
    for (const e of ests) {
      const r = byId.get(e.id);
      if (!r || !contactCodes.has(r.code)) continue;
      if (r.code === "01" && !r.commitmentDate) throw new Error("commitmentRequired");
      const enOp = r.code === "05" ? "No" : r.enOperacion || "Sí";
      const visit = r.code === "04" || (r.code === "03" && !!r.needsVisit) || !!r.needsVisit;
      let follow: string | null = null;
      if (r.code === "01") follow = addBusinessDays(r.commitmentDate!, campaign.followupDays);
      else if (r.code === "03" && !visit) follow = addBusinessDays(today, campaign.followupDays);
      else if (r.code === "06") follow = addBusinessDays(today, 1);
      if (follow && (!nextFollow || follow < nextFollow)) nextFollow = follow;
      if (visit) anyVisit = true;
      const clean = (v: string | null | undefined) => (v ?? "").trim().slice(0, 200) || null;
      const newName = r.code === "06" ? clean(r.newName) : null;
      const newAddress = r.code === "06" ? clean(r.newAddress) : null;
      const newOwner = r.code === "06" ? clean(r.newOwner) : null;
      const email = clean(input.updatedEmail);
      if (enOp !== (e.enOperacion ?? null) && (r.enOperacion || r.code === "05")) changes.push({ establishmentId: e.id, field: "enOperacion", label: "¿En operación?", from: e.enOperacion, to: enOp });
      if (r.closedSince && r.closedSince !== e.cerradoDesde) changes.push({ establishmentId: e.id, field: "cerradoDesde", label: "Cerrado desde", from: e.cerradoDesde, to: r.closedSince });
      if (email && email !== (e.correoActualizado ?? e.correo)) changes.push({ establishmentId: e.id, field: "correo", label: "Correo", from: e.correoActualizado ?? e.correo, to: email });
      if (newName && newName !== e.nombreComercial) changes.push({ establishmentId: e.id, field: "nombreComercial", label: "Nombre comercial", from: e.nombreComercial, to: newName });
      if (newAddress && newAddress !== e.direccion) changes.push({ establishmentId: e.id, field: "direccion", label: "Dirección", from: e.direccion, to: newAddress });
      if (newOwner && newOwner !== e.propietario) changes.push({ establishmentId: e.id, field: "propietario", label: "Dueño / responsable", from: e.propietario, to: newOwner });
      ops.push(
        db.insert(callResults).values({
          attemptId: attempt.id,
          campaignId: company.campaignId,
          establishmentId: e.id,
          code: r.code,
          enOperacion: enOp,
          commitmentDate: r.commitmentDate || null,
          closedSince: r.closedSince || null,
          obstacle: r.obstacle || null,
          notes: r.notes || null,
        }),
      );
      ops.push(
        db
          .update(establishments)
          .set({
            finalCode: r.code,
            enOperacion: enOp,
            fechaCompromiso: r.commitmentDate || e.fechaCompromiso,
            cerradoDesde: r.closedSince || e.cerradoDesde,
            obstaculo: r.obstacle || e.obstaculo,
            requiereVisita: visit ? "Sí" : "No",
            contactoNombre: input.spokeWith || e.contactoNombre,
            contactoCargo: input.spokeRole || e.contactoCargo,
            correoActualizado: input.updatedEmail || e.correoActualizado,
            nombreComercial: newName ?? e.nombreComercial,
            direccion: newAddress ?? e.direccion,
            propietario: newOwner ?? e.propietario,
            responsable: user.name,
            observaciones: r.notes ? [e.observaciones, r.notes].filter(Boolean).join(" | ") : e.observaciones,
          })
          .where(eq(establishments.id, e.id)),
      );
    }
    const status = nextFollow ? "followup" : anyVisit ? "visit" : "done";
    toVisitOut = status === "visit" && company.status !== "visit";
    followupOut = nextFollow;
    ops.push(
      db
        .update(companies)
        .set({
          attempts: attemptNo,
          failedAttempts: 0,
          lastCalledAt: input.calledAt || now,
          lastCode: input.results[0]?.code ?? null,
          status,
          nextActionAt: nextFollow ? businessDayStart(nextFollow) : null,
          whatsappSuggested: false,
        })
        .where(eq(companies.id, company.id)),
    );
  }
  if (ops.length) await db.batch(ops as [typeof ops[0], ...typeof ops]);
  return {
    attemptId: attempt.id, companyId: company.id, key: company.key, campaignId: company.campaignId,
    toVisit: toVisitOut, followupAt: followupOut, answered: !failed,
    result: failed ? failCode : input.results[0]?.code ?? "", changes,
  } satisfies CallOutcome;
}

// Other tasks of the same campaign whose establishment has the same RNC / Cédula.
export async function relatedTasks(company: { id: number; campaignId: number; rnc: string | null }) {
  const key = (company.rnc ?? "").replace(/[^0-9A-Za-z]/g, "");
  if (key.length < 5) return [];
  return db
    .select()
    .from(companies)
    .where(
      and(
        eq(companies.campaignId, company.campaignId),
        ne(companies.id, company.id),
        ne(companies.status, "transferred"),
        sql`replace(replace(replace(coalesce(${companies.rnc}, ''), '-', ''), ' ', ''), '.', '') = ${key}`,
      ),
    );
}

export async function logVisit(
  user: User,
  input: {
    establishmentId: number; visitDate: string; code: string; commitmentDate: string | null; notes: string | null;
    newName?: string | null; newAddress?: string | null; newOwner?: string | null;
  },
) {
  const e = await db.query.establishments.findFirst({ where: eq(establishments.id, input.establishmentId) });
  if (!e) throw new Error("Not found");
  const campaign = (await db.query.campaigns.findFirst({ where: eq(campaigns.id, e.campaignId) }))!;
  const [{ n }] = await db.select({ n: count() }).from(visits).where(eq(visits.establishmentId, e.id));
  const [visit] = await db.insert(visits).values({
    campaignId: e.campaignId,
    establishmentId: e.id,
    userId: user.id,
    visitNo: n + 1,
    visitDate: input.visitDate,
    code: input.code,
    commitmentDate: input.commitmentDate,
    notes: input.notes,
  }).returning({ id: visits.id });
  const enOperacion = input.code === "V4" ? "No" : ["V1", "V2", "V3", "V7"].includes(input.code) ? "Sí" : e.enOperacion;
  await db
    .update(establishments)
    .set({
      enOperacion,
      fechaCompromiso: input.commitmentDate || e.fechaCompromiso,
      observaciones: input.notes ? [e.observaciones, `Visita ${n + 1}: ${input.notes}`].filter(Boolean).join(" | ") : e.observaciones,
      nombreComercial: input.newName || e.nombreComercial,
      direccion: input.newAddress || e.direccion,
      propietario: input.newOwner || e.propietario,
    })
    .where(eq(establishments.id, e.id));
  // What the inspector found and decided, for SIGTUR's change requests.
  const changes: DataChange[] = [];
  if (enOperacion !== e.enOperacion) changes.push({ establishmentId: e.id, field: "enOperacion", label: "¿En operación?", from: e.enOperacion, to: enOperacion });
  if (input.newName && input.newName !== e.nombreComercial) changes.push({ establishmentId: e.id, field: "nombreComercial", label: "Nombre comercial", from: e.nombreComercial, to: input.newName });
  if (input.newAddress && input.newAddress !== e.direccion) changes.push({ establishmentId: e.id, field: "direccion", label: "Dirección", from: e.direccion, to: input.newAddress });
  if (input.newOwner && input.newOwner !== e.propietario) changes.push({ establishmentId: e.id, field: "propietario", label: "Dueño / responsable", from: e.propietario, to: input.newOwner });
  let followupAt: string | null = null;
  // Plan §6.5: phone follow-up 5 business days after the visit when the establishment is operating.
  if (["V1", "V2", "V7"].includes(input.code)) {
    const base = input.code === "V2" && input.commitmentDate ? input.commitmentDate : input.visitDate;
    const next = businessDayStart(addBusinessDays(base, campaign.followupDays));
    const company = await db.query.companies.findFirst({ where: eq(companies.id, e.companyId) });
    const keepEarlier = company?.status === "followup" && company.nextActionAt && company.nextActionAt < next;
    await db
      .update(companies)
      .set({ status: "followup", nextActionAt: keepEarlier ? company!.nextActionAt : next })
      .where(eq(companies.id, e.companyId));
    if (!keepEarlier) followupAt = next.slice(0, 10);
  }
  return { visitId: visit.id, companyId: e.companyId, campaignId: e.campaignId, sigturId: e.sigturId, changes, followupAt };
}

// Visits still to do: needs a visit, and no conclusive visit yet (max 2 visits, per the plan).
export function visitPending(visitCodes: string[]) {
  if (visitCodes.length === 0) return true;
  if (visitCodes.length >= 2) return false;
  return ["V5", "V6"].includes(visitCodes[visitCodes.length - 1]);
}

export async function applyStatusUpdates(
  user: User,
  campaignIds: number[],
  updates: { sigturId: string | null; rut: string | null; status: string; date: string | null }[],
) {
  if (!campaignIds.length) return { updated: 0, notFound: updates.length };
  const ests = await db.select().from(establishments).where(inArray(establishments.campaignId, campaignIds));
  const bySigtur = new Map<string, typeof ests>();
  const byRut = new Map<string, typeof ests>();
  for (const e of ests) {
    bySigtur.set(e.sigturId, [...(bySigtur.get(e.sigturId) ?? []), e]);
    if (e.rut) byRut.set(e.rut.toUpperCase(), [...(byRut.get(e.rut.toUpperCase()) ?? []), e]);
  }
  const visitRows = await db.select({ establishmentId: visits.establishmentId, code: visits.code }).from(visits).where(inArray(visits.campaignId, campaignIds));
  const visitV1 = new Set(visitRows.filter((v) => v.code === "V1" || v.code === "V2").map((v) => v.establishmentId));
  let updated = 0;
  let notFound = 0;
  const touchedCompanies = new Set<number>();
  const ops = [];
  for (const u of updates) {
    const matches = (u.sigturId && bySigtur.get(u.sigturId)) || (u.rut && byRut.get(u.rut.toUpperCase())) || [];
    if (!matches.length) {
      notFound++;
      continue;
    }
    for (const e of matches) {
      if (e.estatusSigturActualizado === u.status) continue;
      const date = u.date ?? todayLocal();
      let canal = e.canalLogro;
      if (!canal && ["En proceso", "Vigente"].includes(u.status)) {
        if (visitV1.has(e.id)) canal = "Visita";
        else if (e.finalCode && ["01", "02", "03", "06"].includes(e.finalCode)) canal = "Llamada";
        else if (e.correoEnviadoFecha && e.correoRebotado !== "Sí") canal = "Correo";
        else canal = "Iniciativa propia";
      }
      ops.push(db.update(establishments).set({ estatusSigturActualizado: u.status, fechaCambioEstatus: date, canalLogro: canal }).where(eq(establishments.id, e.id)));
      ops.push(db.insert(statusChanges).values({ campaignId: e.campaignId, establishmentId: e.id, oldStatus: e.estatusSigturActualizado ?? e.estatusRnt, newStatus: u.status, changedAt: date, userId: user.id }));
      e.estatusSigturActualizado = u.status;
      touchedCompanies.add(e.companyId);
      updated++;
    }
  }
  for (let i = 0; i < ops.length; i += 100) {
    const part = ops.slice(i, i + 100);
    await db.batch(part as [typeof part[0], ...typeof part]);
  }
  // A company whose establishments are all resolved in SIGTUR no longer needs calls.
  for (const cid of touchedCompanies) {
    const list = ests.filter((e) => e.companyId === cid);
    if (list.every((e) => e.estatusSigturActualizado && RESOLVED_STATUSES.includes(e.estatusSigturActualizado))) {
      await db.update(companies).set({ status: "done", nextActionAt: null }).where(eq(companies.id, cid));
    }
  }
  return { updated, notFound };
}
