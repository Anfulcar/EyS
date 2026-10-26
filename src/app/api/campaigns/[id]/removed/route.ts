import ExcelJS from "exceljs";
import { logActivity } from "@/lib/audit";
import { MANAGERS, notFoundResponse, routeUser } from "@/lib/auth";
import { COMPANY_STATUSES, label } from "@/lib/catalog";
import { removedList } from "@/lib/remove";
import { styleHeader, workbookResponse } from "@/lib/sheets";

// «Eliminadas»: the RUTs removed from a campaign, with the reason (supervisors and administrators).
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await routeUser(MANAGERS);
  if (!user) return notFoundResponse();
  const id = Number((await params).id);
  const rows = await removedList(id, 50000);
  await logActivity(user, "export.downloaded", { campaignId: id, entity: "campaign", entityId: id, summary: `RUT eliminados (${rows.length})` });
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Eliminadas");
  ws.columns = [
    { header: "Fecha", key: "at", width: 18 }, { header: "RUT", key: "rut", width: 16 }, { header: "ID SIGTUR", key: "sigturId", width: 14 },
    { header: "Establecimiento", key: "est", width: 32 }, { header: "RNC / Cédula", key: "rnc", width: 16 }, { header: "Estado al eliminar", key: "status", width: 18 },
    { header: "Llamadas", key: "calls", width: 10 }, { header: "Visitas", key: "visits", width: 10 }, { header: "Motivo", key: "reason", width: 40 }, { header: "Eliminado por", key: "by", width: 22 },
  ];
  styleHeader(ws);
  for (const r of rows) {
    ws.addRow({
      at: new Date(new Date(r.removedAt).getTime() - 4 * 3600000), rut: r.rut, sigturId: r.sigturId, est: r.establishment, rnc: r.rnc,
      status: label(COMPANY_STATUSES, r.lastStatus, "es"), calls: r.calls, visits: r.visits, reason: r.reason, by: r.removedByName,
    });
  }
  ws.getColumn(1).numFmt = "dd/mm/yyyy hh:mm";
  return workbookResponse(wb, `RUT_eliminados_campana_${id}.xlsx`);
}
