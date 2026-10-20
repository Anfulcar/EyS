// Sheets and columns of the campaign export. Shared by the export screen (to show the choices)
// and the download (to build only what was chosen).
import { MATRIX_COLUMNS } from "./catalog";

export const MATRIX_EXTRA = ["Contacto (nombre)", "Contacto (cargo)", "Correo actualizado", "Cerrado desde", "Obstáculo", "Teléfonos de la empresa", "Agente asignado", "Estado de la tarea"];

export const EXPORT_SHEETS = [
  { key: "matriz", name: "Matriz de seguimiento", columns: [...MATRIX_COLUMNS.map((m) => m.header), ...MATRIX_EXTRA] },
  {
    key: "llamadas",
    name: "Llamadas",
    columns: ["Fecha y hora", "Intento", "Agente", "ID SIGTUR", "Nombre comercial", "Razón social", "Número marcado", "¿Contactó?", "¿Le atendieron?", "Habló con", "Cargo", "¿Responsable?", "WhatsApp", "Tipificación", "¿En operación?", "Fecha compromiso", "Cerrado desde", "Obstáculo", "Observaciones (llamada)", "Observaciones (establecimiento)", "Revisada", "Revisada por", "Comentario de revisión"],
  },
  { key: "telefonos", name: "Teléfonos", columns: ["Razón social", "RNC", "Número", "Origen", "Tipo", "Motivo", "Detalle", "Sustituye a", "Activo", "Calidad", "Agregado por", "Fecha"] },
  { key: "visitas", name: "Visitas", columns: ["ID SIGTUR", "Nombre comercial", "Zona operativa", "Visita", "Fecha", "Resultado", "Fecha compromiso", "Inspector", "Observaciones"] },
  { key: "estatus", name: "Cambios de estatus", columns: ["ID SIGTUR", "Nombre comercial", "Estatus anterior", "Estatus nuevo", "Fecha cambio", "Cargado por"] },
] as const;

export type ExportSheetKey = (typeof EXPORT_SHEETS)[number]["key"];

export type ExportFilters = { from?: string; to?: string; agent?: string; zone?: string; priority?: string; code?: string; status?: string };
export const EXPORT_FILTER_KEYS = ["from", "to", "agent", "zone", "priority", "code", "status"] as const;

export type ExportChoice = { sheets: Partial<Record<ExportSheetKey, string[]>>; filters: ExportFilters };

// Reads the choice from the download link. A link without "custom" (the old one) exports everything.
export function parseExportChoice(sp: URLSearchParams): ExportChoice {
  const filters: ExportFilters = {};
  for (const k of EXPORT_FILTER_KEYS) {
    const v = sp.get(k)?.trim();
    if (v) filters[k] = v;
  }
  const sheets: ExportChoice["sheets"] = {};
  const custom = sp.get("custom") === "1";
  const chosen = new Set(sp.getAll("sheet"));
  for (const s of EXPORT_SHEETS) {
    if (!custom) {
      sheets[s.key] = [...s.columns];
      continue;
    }
    if (!chosen.has(s.key)) continue;
    const wanted = new Set(sp.getAll(`c_${s.key}`));
    const cols = s.columns.filter((c) => wanted.has(c));
    if (cols.length) sheets[s.key] = cols;
  }
  return { sheets, filters };
}
