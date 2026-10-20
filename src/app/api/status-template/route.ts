import ExcelJS from "exceljs";
import { assertUser, MANAGERS } from "@/lib/auth";
import { SIGTUR_STATUSES } from "@/lib/catalog";
import { addListValidation, styleHeader, workbookResponse } from "@/lib/sheets";

export async function GET() {
  await assertUser(MANAGERS);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Estatus");
  ws.columns = [
    { header: "ID SIGTUR", width: 14 },
    { header: "RUT", width: 24 },
    { header: "Estatus SIGTUR actualizado", width: 28 },
    { header: "Fecha cambio estatus", width: 22 },
  ];
  styleHeader(ws);
  addListValidation(ws, "C2:C20000", `"${SIGTUR_STATUSES.join(",")}"`);
  ws.addRow([8567, "TA-3AZI-1101-04032", "En proceso", new Date()]);
  ws.getColumn(4).numFmt = "dd/mm/yyyy";
  return workbookResponse(wb, "plantilla_estatus_sigtur.xlsx");
}
