import { asc, eq } from "drizzle-orm";
import ExcelJS from "exceljs";
import { db } from "@/db";
import { callAttempts, callResults, campaigns, companies, establishments, phones, statusChanges, users, visits } from "@/db/schema";
import { MANAGERS, notFoundResponse, routeUser } from "@/lib/auth";
import { codeMatrixText, label, MATRIX_COLUMNS, OBSTACLES, PHONE_KINDS, PHONE_REASONS } from "@/lib/catalog";
import { styleHeader, workbookResponse } from "@/lib/sheets";

// Excel has no time zones: write timestamps as Dominican Republic local time (UTC-4).
const d = (v: string | null | undefined) =>
  v ? (v.length === 10 ? new Date(`${v}T12:00:00Z`) : new Date(new Date(v).getTime() - 4 * 3600000)) : null;

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await routeUser(MANAGERS))) return notFoundResponse();
  const id = Number((await params).id);
  const c = await db.query.campaigns.findFirst({ where: eq(campaigns.id, id) });
  if (!c) return notFoundResponse();
  const [ests, results, vis, ph, people, changes, comps] = await Promise.all([
    db.select().from(establishments).where(eq(establishments.campaignId, id)).orderBy(asc(establishments.prioridad), asc(establishments.razonSocial)),
    db
      .select({ r: callResults, a: callAttempts })
      .from(callResults)
      .innerJoin(callAttempts, eq(callAttempts.id, callResults.attemptId))
      .where(eq(callResults.campaignId, id))
      .orderBy(asc(callAttempts.calledAt)),
    db.select().from(visits).where(eq(visits.campaignId, id)).orderBy(asc(visits.visitNo)),
    db.select().from(phones).where(eq(phones.campaignId, id)),
    db.select({ id: users.id, name: users.name }).from(users),
    db.select().from(statusChanges).where(eq(statusChanges.campaignId, id)),
    db.select().from(companies).where(eq(companies.campaignId, id)),
  ]);
  const names = new Map(people.map((p) => [p.id, p.name]));
  const resBy = new Map<number, typeof results>();
  for (const r of results) resBy.set(r.r.establishmentId, [...(resBy.get(r.r.establishmentId) ?? []), r]);
  const visBy = new Map<number, typeof vis>();
  for (const v of vis) visBy.set(v.establishmentId, [...(visBy.get(v.establishmentId) ?? []), v]);
  const estById = new Map(ests.map((e) => [e.id, e]));
  const compById = new Map(comps.map((x) => [x.id, x]));

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Matriz de seguimiento");
  const extraHeaders = ["Contacto (nombre)", "Contacto (cargo)", "Correo actualizado", "Cerrado desde", "Obstáculo", "Teléfonos de la empresa", "Agente asignado", "Estado de la tarea"];
  ws.columns = [...MATRIX_COLUMNS.map((m) => m.header), ...extraHeaders].map((h) => ({ header: h, key: h, width: Math.max(12, Math.min(40, h.length + 4)) }));
  styleHeader(ws);
  const phonesBy = new Map<number, string[]>();
  for (const p of ph) if (p.active) phonesBy.set(p.companyId, [...(phonesBy.get(p.companyId) ?? []), p.number]);
  for (const e of ests) {
    const row: Record<string, unknown> = {};
    for (const m of MATRIX_COLUMNS) {
      if (!m.field) continue;
      const v = (e as Record<string, unknown>)[m.field];
      row[m.header] = m.kind === "date" ? d(v as string | null) : m.field === "finalCode" ? codeMatrixText(v as string) : v;
    }
    const calls = resBy.get(e.id) ?? [];
    calls.slice(0, 3).forEach((x, i) => {
      row[`Llamada ${i + 1} fecha`] = d(x.a.calledAt);
      row[`Llamada ${i + 1} resultado`] = codeMatrixText(x.r.code);
    });
    (visBy.get(e.id) ?? []).slice(0, 2).forEach((v, i) => {
      row[`Visita ${i + 1} fecha`] = d(v.visitDate);
      row[`Visita ${i + 1} resultado`] = codeMatrixText(v.code);
    });
    const comp = compById.get(e.companyId);
    Object.assign(row, {
      "Contacto (nombre)": e.contactoNombre,
      "Contacto (cargo)": e.contactoCargo,
      "Correo actualizado": e.correoActualizado,
      "Cerrado desde": e.cerradoDesde,
      "Obstáculo": label(OBSTACLES, e.obstaculo, "es"),
      "Teléfonos de la empresa": (phonesBy.get(e.companyId) ?? []).join(" / "),
      "Agente asignado": comp?.assignedUserId ? names.get(comp.assignedUserId) : "",
      "Estado de la tarea": comp?.status,
    });
    ws.addRow(row);
  }
  MATRIX_COLUMNS.forEach((m, i) => {
    if (m.kind === "date" || /fecha/i.test(m.header)) ws.getColumn(i + 1).numFmt = "dd/mm/yyyy";
  });

  const wc = wb.addWorksheet("Llamadas");
  wc.columns = ["Fecha y hora", "Intento", "Agente", "ID SIGTUR", "Nombre comercial", "Razón social", "Número marcado", "¿Contactó?", "¿Le atendieron?", "Habló con", "Cargo", "¿Responsable?", "WhatsApp", "Tipificación", "¿En operación?", "Fecha compromiso", "Cerrado desde", "Obstáculo", "Observaciones (llamada)", "Observaciones (establecimiento)"].map((h) => ({ header: h, key: h, width: 18 }));
  styleHeader(wc);
  const yn = (v: boolean | null) => (v == null ? "" : v ? "Sí" : "No");
  for (const { r, a } of results) {
    const e = estById.get(r.establishmentId);
    wc.addRow([d(a.calledAt), a.attemptNo, names.get(a.userId), e?.sigturId, e?.nombreComercial, e?.razonSocial, a.phoneNumber, yn(a.contacted), yn(a.attended), a.spokeWith, a.spokeRole, yn(a.isResponsible), yn(a.whatsappSent), codeMatrixText(r.code), r.enOperacion, d(r.commitmentDate), r.closedSince, label(OBSTACLES, r.obstacle, "es"), a.notes, r.notes]);
  }
  wc.getColumn(1).numFmt = "dd/mm/yyyy hh:mm";

  const wp = wb.addWorksheet("Teléfonos");
  wp.columns = ["Razón social", "RNC", "Número", "Origen", "Tipo", "Motivo", "Detalle", "Sustituye a", "Activo", "Calidad", "Agregado por", "Fecha"].map((h) => ({ header: h, key: h, width: 20 }));
  styleHeader(wp);
  const phoneById = new Map(ph.map((p) => [p.id, p]));
  for (const p of ph) {
    const comp = compById.get(p.companyId);
    wp.addRow([comp?.razonSocial, comp?.rnc, p.number, p.source === "file" ? "Archivo" : "Agregado", label(PHONE_KINDS, p.kind, "es"), label(PHONE_REASONS, p.reason, "es"), p.reasonNote, p.replacesPhoneId ? phoneById.get(p.replacesPhoneId)?.number : "", p.active ? "Sí" : "No", p.quality, p.addedBy ? names.get(p.addedBy) : "", d(p.createdAt)]);
  }

  const wv = wb.addWorksheet("Visitas");
  wv.columns = ["ID SIGTUR", "Nombre comercial", "Zona operativa", "Visita", "Fecha", "Resultado", "Fecha compromiso", "Inspector", "Observaciones"].map((h) => ({ header: h, key: h, width: 20 }));
  styleHeader(wv);
  for (const v of vis) {
    const e = estById.get(v.establishmentId);
    wv.addRow([e?.sigturId, e?.nombreComercial, e?.zonaOperativa, v.visitNo, d(v.visitDate), codeMatrixText(v.code), d(v.commitmentDate), names.get(v.userId), v.notes]);
  }

  const wsc = wb.addWorksheet("Cambios de estatus");
  wsc.columns = ["ID SIGTUR", "Nombre comercial", "Estatus anterior", "Estatus nuevo", "Fecha cambio", "Cargado por"].map((h) => ({ header: h, key: h, width: 20 }));
  styleHeader(wsc);
  for (const s of changes) {
    const e = estById.get(s.establishmentId);
    wsc.addRow([e?.sigturId, e?.nombreComercial, s.oldStatus, s.newStatus, d(s.changedAt), s.userId ? names.get(s.userId) : ""]);
  }
  const safe = c.name.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 60);
  return workbookResponse(wb, `Matriz_${safe}.xlsx`);
}
