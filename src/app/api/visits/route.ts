import ExcelJS from "exceljs";
import { logActivity } from "@/lib/audit";
import { notFoundResponse, routeUser } from "@/lib/auth";
import { codeMatrixText } from "@/lib/catalog";
import { styleHeader, workbookResponse } from "@/lib/sheets";
import { pendingVisits } from "@/lib/visits";

export async function GET(req: Request) {
  const user = await routeUser(["admin", "supervisor", "inspector"]);
  if (!user) return notFoundResponse();
  await logActivity(user, "export.downloaded", { entity: "visits", summary: "Ruta de visitas (Excel)" });
  const sp = new URL(req.url).searchParams;
  const { rows } = await pendingVisits({ campaignId: sp.get("campaign") ? Number(sp.get("campaign")) : undefined, zone: sp.get("zone") ?? undefined, showAll: sp.get("all") === "1" });
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Ruta");
  ws.columns = ["Zona operativa", "Municipio", "Dirección", "Nombre comercial", "Razón social", "ID SIGTUR", "RUT", "Estatus RNT", "Prioridad", "Teléfonos", "Última tipificación", "Visitas previas", "Resultado", "Observaciones"].map((h) => ({ header: h, key: h, width: 22 }));
  styleHeader(ws);
  for (const { e, visits, phones } of rows) {
    ws.addRow([e.zonaOperativa, e.municipio, e.direccion, e.nombreComercial, e.razonSocial, e.sigturId, e.rut, e.estatusRnt, e.prioridad, phones.join(" / "), codeMatrixText(e.finalCode), visits.map((v) => `${v.visitDate} ${v.code}`).join("; "), "", ""]);
  }
  return workbookResponse(wb, `ruta_visitas_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
