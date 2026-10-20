import { and, asc, eq } from "drizzle-orm";
import ExcelJS from "exceljs";
import { db } from "@/db";
import { establishments } from "@/db/schema";
import { assertUser, MANAGERS } from "@/lib/auth";
import { styleHeader, workbookResponse } from "@/lib/sheets";

// Same columns as the "Base correo vencidas" / "Base correo sin licencia" sheets (they match the Annex A/B templates).
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await assertUser(MANAGERS);
  const id = Number((await params).id);
  const ests = await db
    .select()
    .from(establishments)
    .where(and(eq(establishments.campaignId, id), eq(establishments.correoValido, "Sí")))
    .orderBy(asc(establishments.correo));
  const perEmail = new Map<string, number>();
  for (const e of ests) if (e.correo) perEmail.set(e.correo.toLowerCase(), (perEmail.get(e.correo.toLowerCase()) ?? 0) + 1);
  const fmtLong = (v: string | null) => (v ? new Date(`${v}T12:00:00Z`).toLocaleDateString("es-DO", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "");
  const wb = new ExcelJS.Workbook();
  for (const [sheet, status] of [["Base correo vencidas", "Vencida"], ["Base correo sin licencia", "Sin licencia"], ["Otros", null]] as const) {
    const list = ests.filter((e) => (status ? e.estatusRnt === status : e.estatusRnt !== "Vencida" && e.estatusRnt !== "Sin licencia"));
    if (!list.length) continue;
    const ws = wb.addWorksheet(sheet);
    const expired = status === "Vencida";
    const headers = ["Correo", "Nombre comercial", "Razón social", "RUT", "RNC / Cédula", "Actividad", "Municipio", "Provincia", ...(expired ? ["Resolución", "Fecha vencimiento", "Fecha vencimiento (texto)", "Tiempo vencida"] : []), "Establ. con este correo", "Prioridad", "Correo rebotado"];
    ws.columns = headers.map((h) => ({ header: h, key: h, width: 22 }));
    styleHeader(ws);
    for (const e of list) {
      ws.addRow({
        Correo: e.correo, "Nombre comercial": e.nombreComercial, "Razón social": e.razonSocial, RUT: e.rut, "RNC / Cédula": e.rnc,
        Actividad: e.actividad, Municipio: e.municipio, Provincia: e.provincia,
        Resolución: e.resolucion, "Fecha vencimiento": e.fechaVencimiento ? new Date(`${e.fechaVencimiento}T12:00:00Z`) : null,
        "Fecha vencimiento (texto)": fmtLong(e.fechaVencimiento), "Tiempo vencida": e.tiempoVencida,
        "Establ. con este correo": e.correo ? perEmail.get(e.correo.toLowerCase()) : null, Prioridad: e.prioridad, "Correo rebotado": e.correoRebotado,
      });
    }
  }
  if (!wb.worksheets.length) wb.addWorksheet("Vacío");
  return workbookResponse(wb, `base_correo_campana_${id}.xlsx`);
}
