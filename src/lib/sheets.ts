import "server-only";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { MATRIX_COLUMNS } from "./catalog";

export type Row = Record<string, unknown>;

export function normHeader(h: string) {
  return h
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function cellValue(v: ExcelJS.CellValue): unknown {
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    if ("result" in v) return cellValue((v as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue);
    if ("richText" in v) return (v as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join("");
    if ("text" in v) return (v as ExcelJS.CellHyperlinkValue).text;
    if ("error" in v) return null;
    return String(v);
  }
  return v;
}

function isHeaderRow(values: unknown[], wanted: string[]) {
  const set = new Set(values.filter((v) => v != null).map((v) => normHeader(String(v))));
  return wanted.some((w) => set.has(normHeader(w)));
}

// Reads the first sheet that has a recognizable header row (or the sheet named `preferSheet`).
export async function readTable(file: File, wantedHeaders: string[], preferSheet?: string): Promise<{ headers: string[]; rows: Row[] }> {
  const buf = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    let text = buf.toString("utf8");
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true, delimiter: "" });
    const data = parsed.data;
    const hi = data.findIndex((r) => isHeaderRow(r, wantedHeaders));
    const start = hi >= 0 ? hi : 0;
    const headers = (data[start] ?? []).map((h) => String(h ?? "").trim());
    const rows = data.slice(start + 1).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? null])));
    return { headers, rows };
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const sheets = [...wb.worksheets];
  if (preferSheet) sheets.sort((a, b) => Number(b.name === preferSheet) - Number(a.name === preferSheet));
  for (const ws of sheets) {
    let headerRowNo = -1;
    let headers: string[] = [];
    for (let r = 1; r <= Math.min(ws.rowCount, 15); r++) {
      const vals: unknown[] = [];
      ws.getRow(r).eachCell({ includeEmpty: true }, (c, col) => (vals[col - 1] = cellValue(c.value)));
      if (isHeaderRow(vals, wantedHeaders)) {
        headerRowNo = r;
        headers = Array.from(vals, (v) => (v == null ? "" : String(v).trim()));
        break;
      }
    }
    if (headerRowNo < 0) continue;
    const rows: Row[] = [];
    for (let r = headerRowNo + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      if (!row.hasValues) continue;
      const obj: Row = {};
      headers.forEach((h, i) => {
        if (h) obj[h] = cellValue(row.getCell(i + 1).value);
      });
      rows.push(obj);
    }
    return { headers: headers.filter(Boolean), rows };
  }
  return { headers: [], rows: [] };
}

// Maps file headers to Matriz columns (by header name or alias, ignoring accents/case/punctuation).
export function mapMatrixHeaders(headers: string[]) {
  const lookup = new Map<string, string>();
  for (const c of MATRIX_COLUMNS) {
    lookup.set(normHeader(c.header), c.header);
    for (const a of c.aliases ?? []) if (!lookup.has(normHeader(a))) lookup.set(normHeader(a), c.header);
  }
  const mapping: Record<string, string> = {}; // file header -> matrix header
  const ignored: string[] = [];
  const used = new Set<string>();
  for (const h of headers) {
    const m = lookup.get(normHeader(h));
    if (m && !used.has(m)) {
      mapping[h] = m;
      used.add(m);
    } else ignored.push(h);
  }
  const missing = MATRIX_COLUMNS.filter((c) => c.required && !used.has(c.header)).map((c) => c.header);
  return { mapping, ignored, missing };
}

export function str(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  return s === "" ? null : s;
}

export function digits(v: string) {
  return v.replace(/\D/g, "");
}

export function formatPhone(raw: string) {
  const d = digits(raw);
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d.startsWith("1")) return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return raw.trim();
}

export function normalizePhone(raw: string) {
  const d = digits(raw);
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
}

// A cell may hold several numbers: "(809) 555-1234 / 829-555-0000".
export function splitPhones(v: string | null): string[] {
  if (!v) return [];
  return v
    .split(/[\/,;|\n]|\s+(?:y|o|ó)\s+/i)
    .map((s) => s.trim())
    .filter((s) => digits(s).length >= 7);
}

export async function workbookResponse(wb: ExcelJS.Workbook, filename: string) {
  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export function styleHeader(ws: ExcelJS.Worksheet, fill = "FF1E40AF") {
  const row = ws.getRow(1);
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
  row.alignment = { vertical: "middle", wrapText: true };
  row.height = 32;
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

// exceljs supports range data validations at runtime (DataValidations.add), but its typings omit it.
export function addListValidation(ws: ExcelJS.Worksheet, range: string, formula: string) {
  (ws as unknown as { dataValidations: { add: (a: string, v: ExcelJS.DataValidation) => void } }).dataValidations.add(range, {
    type: "list",
    allowBlank: true,
    formulae: [formula],
  });
}
