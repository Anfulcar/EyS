import "server-only";
import { and, count, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { callAttempts, callResults, campaigns, companies, establishments, phones, statusChanges, visits, type User } from "@/db/schema";
import { CONTACT_CODES } from "./catalog";
import { addBusinessDays, addHours, businessDayStart, nowIso, todayLocal } from "./dates";
import { normalizePhone } from "./sheets";

export type EstResultInput = {
  establishmentId: number;
  code: string;
  enOperacion?: string | null;
  commitmentDate?: string | null;
  closedSince?: string | null;
  obstacle?: string | null;
  needsVisit?: boolean;
  notes?: string | null;
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
  if (!c) return null;
  if (user.role === "admin" || user.role === "supervisor") return c;
  if (user.role === "agent" && c.assignedUserId === user.id) return c;
  return null;
}

export async function logCall(user: User, input: CallInput) {
  const company = await canWorkCompany(user, input.companyId);
  if (!company) throw new Error("Forbidden");
  const campaign = (await db.query.campaigns.findFirst({ where: eq(campaigns.id, company.campaignId) }))!;
  const ests = await db.select().from(establishments).where(eq(establishments.companyId, company.id));
  const phone = input.phoneId
    ? await db.query.phones.findFirst({ where: and(eq(phones.id, input.phoneId), eq(phones.companyId, company.id)) })
    : null;

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

  if (failed) {
    // A wrong / dead number is flagged on this task (matched by number, so it also works for shared calls).
    const dialed = phone?.normalized ?? (input.phoneNumber ? normalizePhone(input.phoneNumber) : null);
    const badNumber = (failCode === "07" || failCode === "09") && dialed ? dialed : null;
    if (badNumber) {
      ops.push(
        db
          .update(phones)
          .set({ quality: failCode === "07" ? "wrong" : "out_of_service" })
          .where(and(eq(phones.companyId, company.id), eq(phones.normalized, badNumber))),
      );
    }
    const allPhones = await db.select().from(phones).where(eq(phones.companyId, company.id));
    const usable = allPhones.filter((p) => p.active && p.normalized !== badNumber && (p.quality === "ok" || p.quality === "invalid"));
    const failedAttempts = company.failedAttempts + 1;
    const toVisit = usable.length === 0 || failedAttempts >= campaign.maxAttempts;
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
            responsable: user.name,
            observaciones: r.notes ? [e.observaciones, r.notes].filter(Boolean).join(" | ") : e.observaciones,
          })
          .where(eq(establishments.id, e.id)),
      );
    }
    const status = nextFollow ? "followup" : anyVisit ? "visit" : "done";
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
  return attempt.id;
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
        sql`replace(replace(replace(coalesce(${companies.rnc}, ''), '-', ''), ' ', ''), '.', '') = ${key}`,
      ),
    );
}

export async function logVisit(
  user: User,
  input: { establishmentId: number; visitDate: string; code: string; commitmentDate: string | null; notes: string | null },
) {
  const e = await db.query.establishments.findFirst({ where: eq(establishments.id, input.establishmentId) });
  if (!e) throw new Error("Not found");
  const campaign = (await db.query.campaigns.findFirst({ where: eq(campaigns.id, e.campaignId) }))!;
  const [{ n }] = await db.select({ n: count() }).from(visits).where(eq(visits.establishmentId, e.id));
  await db.insert(visits).values({
    campaignId: e.campaignId,
    establishmentId: e.id,
    userId: user.id,
    visitNo: n + 1,
    visitDate: input.visitDate,
    code: input.code,
    commitmentDate: input.commitmentDate,
    notes: input.notes,
  });
  const enOperacion = input.code === "V4" ? "No" : ["V1", "V2", "V3", "V7"].includes(input.code) ? "Sí" : e.enOperacion;
  await db
    .update(establishments)
    .set({
      enOperacion,
      fechaCompromiso: input.commitmentDate || e.fechaCompromiso,
      observaciones: input.notes ? [e.observaciones, `Visita ${n + 1}: ${input.notes}`].filter(Boolean).join(" | ") : e.observaciones,
    })
    .where(eq(establishments.id, e.id));
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
  }
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
