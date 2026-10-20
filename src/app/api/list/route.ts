import { ne } from "drizzle-orm";
import ExcelJS from "exceljs";
import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { logActivity } from "@/lib/audit";
import { MANAGERS, notFoundResponse, routeUser } from "@/lib/auth";
import { codeMatrixText, COMPANY_STATUSES, label } from "@/lib/catalog";
import { drillTitle } from "@/lib/drill-labels";
import { DICTS } from "@/lib/i18n";
import { styleHeader, workbookResponse } from "@/lib/sheets";
import { drillDown, parseDrill } from "@/lib/stats";

// Excel download of a list opened from a dashboard number.
export async function GET(req: Request) {
  const user = await routeUser(MANAGERS);
  if (!user) return notFoundResponse();
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const ids = sp.campaign
    ? [Number(sp.campaign)]
    : (await db.select({ id: campaigns.id }).from(campaigns).where(sp.include === "open" ? ne(campaigns.status, "closed") : undefined)).map((c) => c.id);
  const f = parseDrill(sp);
  const rows = await drillDown(ids, f);
  const title = drillTitle(f, DICTS.es, "es");
  await logActivity(user, "export.downloaded", { campaignId: sp.campaign ? Number(sp.campaign) : null, entity: "list", summary: `Lista del tablero: ${title} (${rows.length})` });
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Lista");
  ws.columns = ["ID SIGTUR", "RUT", "Nombre comercial", "Razón social", "RNC / Cédula", "Prioridad", "Zona operativa", "Municipio", "Teléfono", "Correo", "Estatus", "Último resultado", "Fecha compromiso", "Requiere visita", "Estado de la tarea", "Asignado a"].map((h) => ({ header: h, key: h, width: 20 }));
  styleHeader(ws);
  for (const { e, task, agent } of rows) {
    ws.addRow([e.sigturId, e.rut, e.nombreComercial, e.razonSocial, e.rnc, e.prioridad, e.zonaOperativa, e.municipio, e.telefono, e.correo, e.estatusSigturActualizado ?? e.estatusRnt, codeMatrixText(e.finalCode), e.fechaCompromiso, e.requiereVisita, task ? label(COMPANY_STATUSES, task.status, "es") : "", agent ?? ""]);
  }
  return workbookResponse(wb, `lista_${title.replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 50)}.xlsx`);
}
