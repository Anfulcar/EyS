import ExcelJS from "exceljs";
import { mkdirSync } from "node:fs";

export const FIXTURE = "tests/e2e/.fixtures/matriz-demo.xlsx";

// Made-up establishments in the Matriz format (no real data in the repository).
export default async function globalSetup() {
  mkdirSync("tests/e2e/.fixtures", { recursive: true });
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Matriz de seguimiento");
  ws.addRow(["ID SIGTUR", "RUT", "Estatus RNT", "Prioridad", "Nombre comercial", "Razón social", "RNC / Cédula", "Subsector", "Provincia", "Municipio", "Zona operativa", "Dirección", "Teléfono", "Teléfono válido", "Correo", "Correo válido", "Fecha vencimiento"]);
  const rows = [
    [9001, "TA-DEMO-0001", "Vencida", "P1", "Buceo Uno", "Mar Azul SRL", "130-900001", "Turismo de aventura", "La Altagracia", "Higüey", "A1. Bávaro – Punta Cana – Cap Cana", "Playa Bávaro 1", "(809) 555-0101", "Sí", "uno@example.com", "Sí", new Date("2024-05-01")],
    [9002, "TA-DEMO-0002", "Sin licencia", "P1", "Buceo Dos", "Mar Azul SRL", "130-900001", "Turismo de aventura", "La Altagracia", "Higüey", "A1. Bávaro – Punta Cana – Cap Cana", "Playa Bávaro 2", "(809) 555-0102", "Sí", "dos@example.com", "Sí", null],
    [9003, "GS-DEMO-0003", "Vencida", "P2", "Tienda Tres", "Tienda Tres SRL", "131-900003", "Gift shops", "La Romana", "La Romana", "D. La Romana – Casa de Campo – Isla Catalina", "Calle 3", "(829) 555-0103", "Sí", "tres@example.com", "Sí", new Date("2021-03-15")],
    [9004, "AB-DEMO-0004", "Vencida", "P3", "Bar Cuatro", "Bar Cuatro SRL", "132-900004", "Alimentos y bebidas", "La Altagracia", "Higüey", "B. Higüey ciudad", "Calle 4", "(849) 555-0104", "Sí", "", "No", new Date("2019-01-10")],
  ];
  for (const r of rows) ws.addRow(r);
  await wb.xlsx.writeFile(FIXTURE);
}
