import ExcelJS from "exceljs";
import { logActivity } from "@/lib/audit";
import { MANAGERS, notFoundResponse, routeUser } from "@/lib/auth";
import { buildInteractions } from "@/lib/sigtur";
import { styleHeader, workbookResponse } from "@/lib/sheets";

// Excel with the SIGTUR interactions of a date range («Informes» → «Descargar interacciones»).
export async function GET(req: Request) {
  const user = await routeUser(MANAGERS);
  if (!user) return notFoundResponse();
  const sp = new URL(req.url).searchParams;
  const date = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  const from = date(sp.get("from"));
  const to = date(sp.get("to"));
  const items = await buildInteractions({ from, to });
  await logActivity(user, "export.downloaded", { entity: "interactions", summary: `Interacciones SIGTUR ${from ?? "…"} – ${to ?? "…"} (${items.length})` });
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Interacciones");
  const cols: [string, keyof (typeof items)[number]][] = [
    ["ID interacción", "id"], ["ID SIGTUR", "idSigtur"], ["RUT", "rut"], ["Nombre comercial", "nombreComercial"], ["Fecha y hora", "fechaHora"],
    ["Canal", "canal"], ["Dirección", "direccion"], ["Realizado por", "realizadoPor"], ["Número marcado", "numeroMarcado"],
    ["Persona contactada", "personaContactada"], ["Cargo", "cargo"], ["Resultado", "resultado"], ["Fecha compromiso", "fechaCompromiso"],
    ["Obstáculo", "obstaculo"], ["Notas", "notas"], ["Campaña", "campana"], ["Solicitud SIGTUR", "solicitudSigtur"], ["Solicitado por", "solicitadoPor"],
  ];
  ws.columns = cols.map(([h]) => ({ header: h, key: h, width: Math.max(14, h.length + 4) }));
  styleHeader(ws);
  for (const it of items) {
    ws.addRow(Object.fromEntries(cols.map(([h, k]) => [h, k === "fechaHora" ? new Date(new Date(it.fechaHora).getTime() - 4 * 3600000) : k === "solicitudSigtur" ? (it.solicitudSigtur ? "Sí" : "No") : it[k]])));
  }
  ws.getColumn(5).numFmt = "dd/mm/yyyy hh:mm";
  return workbookResponse(wb, `Interacciones_SIGTUR_${from ?? "inicio"}_${to ?? "hoy"}.xlsx`);
}
