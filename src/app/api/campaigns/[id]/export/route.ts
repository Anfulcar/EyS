import { asc, eq } from "drizzle-orm";
import ExcelJS from "exceljs";
import { db } from "@/db";
import { logActivity } from "@/lib/audit";
import { callAttempts, callResults, campaigns, companies, establishments, phones, statusChanges, users, visits } from "@/db/schema";
import { MANAGERS, notFoundResponse, routeUser } from "@/lib/auth";
import { codeMatrixText, label, MATRIX_COLUMNS, OBSTACLES, operationOf, PHONE_KINDS, PHONE_REASONS } from "@/lib/catalog";
import { localDayEnd, localDayStart } from "@/lib/dates";
import { EXPORT_SHEETS, parseExportChoice, type ExportSheetKey } from "@/lib/export-spec";
import { styleHeader, workbookResponse } from "@/lib/sheets";

// Excel has no time zones: write timestamps as Dominican Republic local time (UTC-4).
const d = (v: string | null | undefined) =>
  v ? (v.length === 10 ? new Date(`${v}T12:00:00Z`) : new Date(new Date(v).getTime() - 4 * 3600000)) : null;

const DATE_TIME_COLS = new Set(["Fecha y hora", "Revisada", "Llamada 1 fecha", "Llamada 2 fecha", "Llamada 3 fecha"]);

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await routeUser(MANAGERS);
  if (!user) return notFoundResponse();
  const id = Number((await params).id);
  const c = await db.query.campaigns.findFirst({ where: eq(campaigns.id, id) });
  if (!c) return notFoundResponse();
  const { sheets, filters: f } = parseExportChoice(new URL(req.url).searchParams);
  const chosen = Object.keys(sheets) as ExportSheetKey[];
  if (!chosen.length) return new Response("No sheet chosen", { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const filterText = Object.entries(f).map(([k, v]) => `${k}=${v}`).join(", ");
  await logActivity(user, "export.downloaded", {
    campaignId: id, entity: "campaign", entityId: id,
    summary: `Exportación (Excel): ${chosen.map((k) => EXPORT_SHEETS.find((s) => s.key === k)!.name).join(", ")}${filterText ? ` · filtros: ${filterText}` : ""}`.slice(0, 500),
  });
  const [allEsts, allResults, allVis, allPh, people, allChanges, comps] = await Promise.all([
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
  const compById = new Map(comps.map((x) => [x.id, x]));

  // Filters on establishments: zone, priority, final result, assigned agent and task status.
  const ests = allEsts.filter((e) => {
    const comp = compById.get(e.companyId);
    if (f.zone && e.zonaOperativa !== f.zone) return false;
    if (f.priority && e.prioridad !== f.priority) return false;
    if (f.code && e.finalCode !== f.code) return false;
    if (f.status && comp?.status !== f.status) return false;
    if (f.op && operationOf(e) !== f.op) return false;
    if (f.agent === "none" ? comp?.assignedUserId != null : f.agent && comp?.assignedUserId !== Number(f.agent)) return false;
    return true;
  });
  const estById = new Map(ests.map((e) => [e.id, e]));
  const companyIds = new Set(ests.map((e) => e.companyId));
  // Dates (local days) filter calls, visits and status changes.
  const inRange = (v: string | null | undefined) => {
    if (!f.from && !f.to) return true;
    if (!v) return false;
    if (v.length === 10) return (!f.from || v >= f.from) && (!f.to || v <= f.to);
    return (!f.from || v >= localDayStart(f.from)) && (!f.to || v <= localDayEnd(f.to));
  };
  const results = allResults.filter((x) => estById.has(x.r.establishmentId) && inRange(x.a.calledAt));
  const vis = allVis.filter((v) => estById.has(v.establishmentId) && inRange(v.visitDate));
  const changes = allChanges.filter((s) => estById.has(s.establishmentId) && inRange(s.changedAt));
  const ph = allPh.filter((p) => companyIds.has(p.companyId));

  const wb = new ExcelJS.Workbook();
  // Adds a sheet with only the chosen columns, in the standard order.
  const addSheet = (key: ExportSheetKey, rows: Record<string, unknown>[], dateCols: Set<string> = new Set()) => {
    const cols = sheets[key];
    if (!cols) return;
    const spec = EXPORT_SHEETS.find((s) => s.key === key)!;
    const ws = wb.addWorksheet(spec.name);
    ws.columns = cols.map((h) => ({ header: h, key: h, width: key === "matriz" ? Math.max(12, Math.min(40, h.length + 4)) : Math.max(18, Math.min(40, h.length + 4)) }));
    styleHeader(ws);
    for (const r of rows) ws.addRow(Object.fromEntries(cols.map((h) => [h, r[h]])));
    cols.forEach((h, i) => {
      if (DATE_TIME_COLS.has(h)) ws.getColumn(i + 1).numFmt = "dd/mm/yyyy hh:mm";
      else if (dateCols.has(h)) ws.getColumn(i + 1).numFmt = "dd/mm/yyyy";
    });
  };
  const yn = (v: boolean | null) => (v == null ? "" : v ? "Sí" : "No");

  if (sheets.matriz) {
    const resBy = new Map<number, typeof results>();
    for (const r of allResults) resBy.set(r.r.establishmentId, [...(resBy.get(r.r.establishmentId) ?? []), r]);
    const visBy = new Map<number, typeof vis>();
    for (const v of allVis) visBy.set(v.establishmentId, [...(visBy.get(v.establishmentId) ?? []), v]);
    const phonesBy = new Map<number, string[]>();
    for (const p of ph) if (p.active) phonesBy.set(p.companyId, [...(phonesBy.get(p.companyId) ?? []), p.number]);
    const rows = ests.map((e) => {
      const row: Record<string, unknown> = {};
      for (const m of MATRIX_COLUMNS) {
        if (!m.field) continue;
        const v = (e as Record<string, unknown>)[m.field];
        row[m.header] = m.kind === "date" ? d(v as string | null) : m.field === "finalCode" ? codeMatrixText(v as string) : v;
      }
      (resBy.get(e.id) ?? []).slice(0, 3).forEach((x, i) => {
        row[`Llamada ${i + 1} fecha`] = d(x.a.calledAt);
        row[`Llamada ${i + 1} resultado`] = codeMatrixText(x.r.code);
      });
      (visBy.get(e.id) ?? []).slice(0, 2).forEach((v, i) => {
        row[`Visita ${i + 1} fecha`] = d(v.visitDate);
        row[`Visita ${i + 1} resultado`] = codeMatrixText(v.code);
      });
      const comp = compById.get(e.companyId);
      return Object.assign(row, {
        "Contacto (nombre)": e.contactoNombre,
        "Contacto (cargo)": e.contactoCargo,
        "Correo actualizado": e.correoActualizado,
        "¿Recibió el correo?": e.correoRecibido,
        "Cerrado desde": e.cerradoDesde,
        "Obstáculo": label(OBSTACLES, e.obstaculo, "es"),
        "Teléfonos de la empresa": (phonesBy.get(e.companyId) ?? []).join(" / "),
        "Agente asignado": comp?.assignedUserId ? names.get(comp.assignedUserId) : "",
        "Estado de la tarea": comp?.status,
      });
    });
    addSheet("matriz", rows, new Set(MATRIX_COLUMNS.filter((m) => m.kind === "date" || /fecha/i.test(m.header)).map((m) => m.header)));
  }

  addSheet(
    "llamadas",
    results.map(({ r, a }) => {
      const e = estById.get(r.establishmentId);
      return {
        "Fecha y hora": d(a.calledAt), Intento: a.attemptNo, Agente: names.get(a.userId), "ID SIGTUR": e?.sigturId, "Nombre comercial": e?.nombreComercial,
        "Razón social": e?.razonSocial, "Número marcado": a.phoneNumber, "¿Contactó?": yn(a.contacted), "¿Le atendieron?": yn(a.attended), "Habló con": a.spokeWith,
        Cargo: a.spokeRole, "¿Responsable?": yn(a.isResponsible), WhatsApp: yn(a.whatsappSent), "¿Recibió el correo?": a.emailReceived, "Tipificación": codeMatrixText(r.code), "¿En operación?": r.enOperacion,
        "Fecha compromiso": d(r.commitmentDate), "Cerrado desde": r.closedSince, "Obstáculo": label(OBSTACLES, r.obstacle, "es"), "Observaciones (llamada)": a.notes,
        "Observaciones (establecimiento)": r.notes, Revisada: d(a.reviewedAt), "Revisada por": a.reviewedBy ? names.get(a.reviewedBy) : "", "Comentario de revisión": a.reviewComment,
      };
    }),
    new Set(["Fecha compromiso"]),
  );

  const phoneById = new Map(allPh.map((p) => [p.id, p]));
  addSheet(
    "telefonos",
    ph.map((p) => {
      const comp = compById.get(p.companyId);
      return {
        "Razón social": comp?.razonSocial, RNC: comp?.rnc, "Número": p.number, Origen: p.source === "file" ? "Archivo" : "Agregado", Tipo: label(PHONE_KINDS, p.kind, "es"),
        Motivo: label(PHONE_REASONS, p.reason, "es"), Detalle: p.reasonNote, "Sustituye a": p.replacesPhoneId ? phoneById.get(p.replacesPhoneId)?.number : "",
        Activo: p.active ? "Sí" : "No", Calidad: p.quality, "Agregado por": p.addedBy ? names.get(p.addedBy) : "", Fecha: d(p.createdAt),
      };
    }),
  );

  addSheet(
    "visitas",
    vis.map((v) => {
      const e = estById.get(v.establishmentId);
      return {
        "ID SIGTUR": e?.sigturId, "Nombre comercial": e?.nombreComercial, "Zona operativa": e?.zonaOperativa, Visita: v.visitNo, Fecha: d(v.visitDate),
        Resultado: codeMatrixText(v.code), "Fecha compromiso": d(v.commitmentDate), Inspector: names.get(v.userId), Observaciones: v.notes,
      };
    }),
  );

  addSheet(
    "estatus",
    changes.map((s) => {
      const e = estById.get(s.establishmentId);
      return { "ID SIGTUR": e?.sigturId, "Nombre comercial": e?.nombreComercial, "Estatus anterior": s.oldStatus, "Estatus nuevo": s.newStatus, "Fecha cambio": d(s.changedAt), "Cargado por": s.userId ? names.get(s.userId) : "" };
    }),
  );

  const safe = c.name.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 60);
  return workbookResponse(wb, `Matriz_${safe}.xlsx`);
}
