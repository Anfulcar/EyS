import ExcelJS from "exceljs";
import { logActivity } from "@/lib/audit";
import { MANAGERS, notFoundResponse, routeUser } from "@/lib/auth";
import { CHANGE_FIELDS, changeRows } from "@/lib/changes";
import { localDateOf } from "@/lib/dates";
import { styleHeader, workbookResponse } from "@/lib/sheets";

// «Reporte de cambios» as Excel, with the same filters as the screen (to update SIGTUR by hand).
export async function GET(req: Request) {
  const user = await routeUser(MANAGERS);
  if (!user) return notFoundResponse();
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const rows = await changeRows({ campaign: sp.campaign, field: sp.field, state: sp.state, from: sp.from, to: sp.to, q: sp.q }, 50000);
  await logActivity(user, "export.downloaded", { entity: "change", summary: `Reporte de cambios (${rows.length} filas)` });
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Cambios");
  const headers = ["Fecha", "Fecha aproximada", "RUT", "ID SIGTUR", "Establecimiento", "Campaña", "Dato", "Valor anterior", "Valor nuevo", "Cambiado por", "Origen", "Estado en SIGTUR", "Actualizado en SIGTUR por", "Fecha actualizado en SIGTUR"];
  ws.columns = headers.map((h) => ({ header: h, key: h, width: h.startsWith("Valor") || h === "Establecimiento" ? 32 : 20 }));
  styleHeader(ws);
  for (const r of rows) {
    ws.addRow([
      localDateOf(r.at), r.approximate ? "Sí" : "No", r.rut, r.sigturId, r.establishment, r.campaignName, CHANGE_FIELDS[r.field]?.es ?? r.label, r.fromValue, r.toValue,
      r.byName, r.source, r.sigturDoneAt ? "Actualizado en SIGTUR" : "Pendiente en SIGTUR", r.sigturDoneByName, r.sigturDoneAt ? localDateOf(r.sigturDoneAt) : null,
    ]);
  }
  return workbookResponse(wb, "reporte_cambios.xlsx");
}
