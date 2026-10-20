import ExcelJS from "exceljs";
import { assertUser, MANAGERS } from "@/lib/auth";
import { CALL_CODES, CHANNELS, codeMatrixText, MATRIX_COLUMNS, SIGTUR_STATUSES, VISIT_CODES } from "@/lib/catalog";
import { addListValidation, styleHeader, workbookResponse } from "@/lib/sheets";

export async function GET() {
  await assertUser(MANAGERS);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Matriz de seguimiento");
  ws.columns = MATRIX_COLUMNS.map((c) => ({ header: c.header, key: c.header, width: Math.max(14, c.header.length + 2) }));
  styleHeader(ws);
  MATRIX_COLUMNS.forEach((c, i) => {
    const cell = ws.getRow(1).getCell(i + 1);
    if (c.required) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB91C1C" } };
    else if (!c.field || i >= 27) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCA8A04" } };
  });
  ws.addRow({
    "ID SIGTUR": 8567, RUT: "TA-3AZI-1101-04032", "Estatus RNT": "Sin licencia", Prioridad: "P1",
    "Nombre comercial": "DOMINICAN TAINO PARK", "Razón social": "ADVENTURE BOOGIES SRL", "RNC / Cédula": "130-527261",
    Subsector: "Turismo de aventura", Actividad: "Aéreas", Provincia: "La Altagracia", Municipio: "Higüey",
    "Zona operativa": "A1. Bávaro – Punta Cana – Cap Cana", Dirección: "LOS HOYOS DEL SALADO, BAVARO",
    Teléfono: "(809) 403-6993", "Teléfono válido": "Sí", Correo: "correo@ejemplo.com", "Correo válido": "Sí",
    Contactabilidad: "Correo y teléfono", "Establ. misma empresa": 5, "Establ. mismo correo": 7, Antigüedad: "N/A (sin licencia)",
  });
  ws.getRow(2).font = { italic: true, color: { argb: "FF64748B" } };

  const lists = wb.addWorksheet("Listas");
  const cols: [string, string[]][] = [
    ["Tipificación llamada", Object.keys(CALL_CODES).map(codeMatrixText)],
    ["Tipificación visita", Object.keys(VISIT_CODES).map(codeMatrixText)],
    ["Estatus SIGTUR", SIGTUR_STATUSES],
    ["Canal", CHANNELS],
    ["Sí/No", ["Sí", "No"]],
    ["Prioridad", ["P1", "P2", "P3"]],
  ];
  cols.forEach(([h, vals], i) => {
    lists.getCell(1, i + 1).value = h;
    vals.forEach((v, j) => (lists.getCell(j + 2, i + 1).value = v));
    lists.getColumn(i + 1).width = 45;
  });
  styleHeader(lists);
  const L = (col: string, n: number) => `Listas!$${col}$2:$${col}$${n + 1}`;
  const validations: [string, string][] = [
    ["Estatus RNT", L("C", SIGTUR_STATUSES.length)],
    ["Prioridad", L("F", 3)],
    ["Teléfono válido", L("E", 2)],
    ["Correo válido", L("E", 2)],
    ["Correo rebotado", L("E", 2)],
    ["Tipificación final", L("A", 10)],
    ["¿En operación?", L("E", 2)],
    ["Requiere visita", L("E", 2)],
    ["Estatus SIGTUR actualizado", L("C", SIGTUR_STATUSES.length)],
    ["Canal que logró la gestión", L("D", CHANNELS.length)],
  ];
  for (const [h, f] of validations) {
    const idx = MATRIX_COLUMNS.findIndex((c) => c.header === h) + 1;
    const letter = ws.getColumn(idx).letter;
    addListValidation(ws, `${letter}2:${letter}20000`, f);
  }

  const ins = wb.addWorksheet("Instrucciones");
  ins.getColumn(1).width = 120;
  [
    "PLANTILLA MAESTRA – CARGA DE ESTABLECIMIENTOS / MASTER UPLOAD TEMPLATE",
    "",
    "1. Una fila por establecimiento en la hoja «Matriz de seguimiento». No cambie los encabezados. / One row per establishment; do not rename headers.",
    "2. Obligatorias (rojo): ID SIGTUR y Nombre comercial. / Required (red): ID SIGTUR and Nombre comercial.",
    "3. RNC / Cédula agrupa los establecimientos en una sola tarea de llamada por empresa. Si falta, se agrupa por Razón social. / RNC groups establishments into one call task per company.",
    "4. Teléfono: puede poner varios números separados por « / » o « , ». Todos quedan disponibles en la tarea. / Several numbers allowed, separated by / or ,",
    "5. Fechas en formato fecha de Excel o AAAA-MM-DD o DD/MM/AAAA. / Dates as Excel dates, YYYY-MM-DD or DD/MM/YYYY.",
    "6. Columnas amarillas (seguimiento) son opcionales: si vienen llenas se cargan, si vienen vacías no borran lo registrado. / Yellow tracking columns are optional and never erase existing data when empty.",
    "7. Las columnas «Llamada 1..3» y «Visita 1..2» se ignoran al cargar: las llamadas se registran en la aplicación. / Call and visit columns are ignored on upload.",
    "8. Si el ID SIGTUR ya existe en la campaña, se actualiza. Puede volver a cargar el archivo corregido. / Existing IDs are updated.",
    "9. Borre la fila de ejemplo (fila 2) antes de cargar. / Delete the sample row (row 2) before uploading.",
    "10. Columnas adicionales no reconocidas se guardan como datos extra del establecimiento. / Unknown columns are stored as extra data.",
  ].forEach((line, i) => {
    const cell = ins.getCell(i + 1, 1);
    cell.value = line;
    if (i === 0) cell.font = { bold: true, size: 14 };
  });
  return workbookResponse(wb, "plantilla_maestra_establecimientos.xlsx");
}
