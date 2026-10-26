// Code lists from the "Listas" sheet of the Matriz de seguimiento, plus the rules of the plan (§5.4–5.5, §6).

export type Lang = "es" | "en";
type L = { es: string; en: string };

export const CALL_CODES: Record<string, L & { contacted: boolean }> = {
  "01": { es: "En operación – iniciará solicitud (compromiso)", en: "Operating – will apply (commitment)", contacted: true },
  "02": { es: "En operación – ya inició solicitud", en: "Operating – already applied", contacted: true },
  "03": { es: "En operación – requiere asistencia / cita", en: "Operating – needs help / appointment", contacted: true },
  "04": { es: "En operación – no interesado / se niega", en: "Operating – not interested / refuses", contacted: true },
  "05": { es: "Cerró operaciones", en: "Closed down", contacted: true },
  "06": { es: "Cambió dueño / nombre / dirección", en: "Changed owner / name / address", contacted: true },
  "07": { es: "Número equivocado", en: "Wrong number", contacted: false },
  "08": { es: "No contesta", en: "No answer", contacted: false },
  "09": { es: "Fuera de servicio / no existe", en: "Out of service / does not exist", contacted: false },
  "10": { es: "Buzón / devolver llamada", en: "Voicemail / call back", contacted: false },
};
export const CONTACT_CODES = ["01", "02", "03", "04", "05", "06"] as const;

// Operating status of an establishment (Resumen, Estadísticas, informes, filters): closed wins over everything.
export const OPERATION_KEYS = ["yes", "no", "unknown", "none"] as const;
export type OperationKey = (typeof OPERATION_KEYS)[number];
export const OPERATION_LABELS: Record<OperationKey, L> = {
  yes: { es: "En operación", en: "Operating" },
  no: { es: "No opera / cerrado", en: "Not operating / closed" },
  unknown: { es: "No sabe", en: "Doesn't know" },
  none: { es: "Sin dato", en: "No data" },
};
export function operationOf(e: { enOperacion: string | null; finalCode: string | null; estatusSigturActualizado?: string | null }): OperationKey {
  if (e.enOperacion === "No" || e.finalCode === "05" || e.estatusSigturActualizado === "Inactivo (depurado)") return "no";
  if (e.enOperacion === "Sí") return "yes";
  if (e.enOperacion === "No sabe") return "unknown";
  return "none";
}
export const NO_CONTACT_CODES = ["07", "08", "09", "10"] as const;

export const VISIT_CODES: Record<string, L> = {
  V1: { es: "Solicitud iniciada en la visita", en: "Application started during visit" },
  V2: { es: "En operación – compromiso con fecha", en: "Operating – commitment with date" },
  V3: { es: "En operación – se niega", en: "Operating – refuses" },
  V4: { es: "Cerrado (verificado en sitio)", en: "Closed (verified on site)" },
  V5: { es: "No localizado en la dirección", en: "Not found at address" },
  V6: { es: "Responsable ausente – revisitar", en: "Person in charge absent – revisit" },
  V7: { es: "Cambio de dirección / razón social", en: "Changed address / company name" },
};

export const SIGTUR_STATUSES = ["Vencida", "Sin licencia", "Incompleta", "En proceso", "Vigente", "Inactivo (depurado)"];
export const CHANNELS = ["Correo", "Llamada", "Visita", "Jornada de formalización", "Iniciativa propia"];

export const OBSTACLES: Record<string, L> = {
  documentos: { es: "Documentos", en: "Documents" },
  usuario: { es: "Usuario de la plataforma", en: "Platform user account" },
  costo: { es: "Costo", en: "Cost" },
  desconocimiento: { es: "Desconocimiento del trámite", en: "Unaware of the process" },
  ninguno: { es: "Ninguno", en: "None" },
  otro: { es: "Otro", en: "Other" },
};

export const PHONE_REASONS: Record<string, L> = {
  file_wrong: { es: "El número en archivo es equivocado", en: "Number on file is wrong" },
  file_out_of_service: { es: "El número en archivo está fuera de servicio", en: "Number on file is out of service" },
  given_by_contact: { es: "Lo proporcionó el contacto en la llamada", en: "Given by the contact during the call" },
  other_source: { es: "Encontrado en otra fuente (web, redes, otra empresa)", en: "Found elsewhere (web, social, another company)" },
  direct_line: { es: "Línea directa del responsable", en: "Direct line of the person in charge" },
  other: { es: "Otro", en: "Other" },
};

export const PHONE_KINDS: Record<string, L> = {
  original: { es: "En archivo", en: "On file" },
  substitute: { es: "Sustituye al de archivo", en: "Replaces number on file" },
  additional: { es: "Adicional", en: "Additional" },
};

export const COMPANY_STATUSES: Record<string, L> = {
  pending: { es: "Sin llamar", en: "Not called" },
  retry: { es: "Reintentar", en: "Retry" },
  followup: { es: "Seguimiento", en: "Follow-up" },
  visit: { es: "Pasa a visita", en: "Sent to visit" },
  done: { es: "Finalizada", en: "Done" },
  transferred: { es: "Transferida", en: "Transferred" },
};
// Tasks nobody works any more (finished, or moved to another campaign).
export const CLOSED_STATUSES = ["done", "transferred"];

export const ROLES: Record<string, L> = {
  admin: { es: "Administrador", en: "Administrator" },
  supervisor: { es: "Supervisor", en: "Supervisor" },
  agent: { es: "Agente de llamadas", en: "Call agent" },
  inspector: { es: "Inspector (visitas)", en: "Inspector (visits)" },
};

export function label(map: Record<string, L>, key: string | null | undefined, lang: Lang) {
  if (!key) return "";
  const v = map[key];
  return v ? v[lang] : key;
}

// Codes (01–10, V1–V7) are kept internally but never shown: lists display only the text.
export function codeLabel(code: string | null | undefined, lang: Lang) {
  if (!code) return "";
  const v = CALL_CODES[code] ?? VISIT_CODES[code];
  return v ? v[lang] : code;
}

// Text used in Excel files (Spanish, without the code).
export function codeMatrixText(code: string | null | undefined) {
  return codeLabel(code, "es");
}

function normText(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Accepts "01", "1", "01 En operación…", "V3 …" or just the text ("No contesta", "No answer") and returns the code.
export function parseCode(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  const v = s.match(/^(V\d)\b/i);
  if (v) return v[1].toUpperCase();
  const n = s.match(/^(\d{1,2})\b/);
  if (n) return n[1].padStart(2, "0");
  const t = normText(s);
  for (const [code, l] of [...Object.entries(CALL_CODES), ...Object.entries(VISIT_CODES)]) {
    if (normText(l.es) === t || normText(l.en) === t) return code;
  }
  return null;
}

// ---- Columns of the "Matriz de seguimiento" (in order). `field` is the establishments column. ----
export type MatrixColumn = { header: string; field?: string; kind?: "date" | "int"; required?: boolean; aliases?: string[] };

export const MATRIX_COLUMNS: MatrixColumn[] = [
  { header: "ID SIGTUR", field: "sigturId", required: true, aliases: ["Identificador", "ID"] },
  { header: "RUT", field: "rut" },
  { header: "Estatus RNT", field: "estatusRnt" },
  { header: "Prioridad", field: "prioridad" },
  { header: "Nombre comercial", field: "nombreComercial", required: true },
  { header: "Razón social", field: "razonSocial" },
  { header: "RNC / Cédula", field: "rnc", aliases: ["RNC", "Cédula", "Número de identificación"] },
  { header: "Subsector", field: "subsector" },
  { header: "Actividad", field: "actividad" },
  { header: "Provincia", field: "provincia" },
  { header: "Municipio", field: "municipio" },
  { header: "Zona operativa", field: "zonaOperativa" },
  { header: "Zona turística (SIGTUR)", field: "zonaTuristica", aliases: ["Zona turística"] },
  { header: "Dirección", field: "direccion" },
  { header: "Teléfono", field: "telefono", aliases: ["Teléfonos", "Telefono"] },
  { header: "Teléfono válido", field: "telefonoValido" },
  { header: "Correo", field: "correo", aliases: ["Email", "E-mail"] },
  { header: "Correo válido", field: "correoValido" },
  { header: "Contactabilidad", field: "contactabilidad" },
  { header: "Establ. misma empresa", field: "establMismaEmpresa", kind: "int" },
  { header: "Establ. mismo correo", field: "establMismoCorreo", kind: "int" },
  { header: "Resolución", field: "resolucion", aliases: ["Resolución actual"] },
  { header: "Fecha emisión", field: "fechaEmision", kind: "date", aliases: ["Resolución - Fecha de emisión"] },
  { header: "Fecha vencimiento", field: "fechaVencimiento", kind: "date", aliases: ["Resolución - Fecha de vencimiento"] },
  { header: "Días vencida", field: "diasVencida", kind: "int" },
  { header: "Tiempo vencida", field: "tiempoVencida" },
  { header: "Antigüedad", field: "antiguedad" },
  { header: "Correo enviado (fecha)", field: "correoEnviadoFecha", kind: "date" },
  { header: "Correo rebotado", field: "correoRebotado" },
  { header: "Llamada 1 fecha" },
  { header: "Llamada 1 resultado" },
  { header: "Llamada 2 fecha" },
  { header: "Llamada 2 resultado" },
  { header: "Llamada 3 fecha" },
  { header: "Llamada 3 resultado" },
  { header: "Tipificación final", field: "finalCode" },
  { header: "¿En operación?", field: "enOperacion" },
  { header: "Fecha compromiso", field: "fechaCompromiso", kind: "date" },
  { header: "Requiere visita", field: "requiereVisita" },
  { header: "Visita 1 fecha" },
  { header: "Visita 1 resultado" },
  { header: "Visita 2 fecha" },
  { header: "Visita 2 resultado" },
  { header: "Estatus SIGTUR actualizado", field: "estatusSigturActualizado" },
  { header: "Fecha cambio estatus", field: "fechaCambioEstatus", kind: "date" },
  { header: "Canal que logró la gestión", field: "canalLogro" },
  { header: "Responsable", field: "responsable" },
  { header: "Observaciones", field: "observaciones" },
];

export const PRIORITY_ORDER: Record<string, number> = { P1: 1, P2: 2, P3: 3 };

export const ABSENCE_LABELS: Record<string, L> = {
  vacation: { es: "Vacaciones", en: "Vacation" },
  day_off: { es: "Día libre", en: "Day off" },
  unavailable: { es: "No disponible", en: "Unavailable" },
};

export const ACTIVITY_LABELS: Record<string, L> = {
  "login.success": { es: "Inicio de sesión", en: "Signed in" },
  "login.failed": { es: "Inicio de sesión fallido", en: "Failed sign-in" },
  "login.locked": { es: "Cuenta bloqueada por intentos", en: "Account locked (attempts)" },
  "login.reauth": { es: "Contraseña confirmada (acción sensible)", en: "Password confirmed (sensitive action)" },
  logout: { es: "Cierre de sesión", en: "Signed out" },
  "password.changed": { es: "Cambio de contraseña", en: "Password changed" },
  "user.created": { es: "Usuario creado", en: "User created" },
  "user.updated": { es: "Usuario editado", en: "User edited" },
  "user.role_changed": { es: "Cambio de rol", en: "Role changed" },
  "user.status_changed": { es: "Usuario activado/desactivado", en: "User activated/deactivated" },
  "user.password_reset": { es: "Contraseña restablecida", en: "Password reset" },
  "campaign.created": { es: "Campaña creada", en: "Campaign created" },
  "campaign.updated": { es: "Campaña editada", en: "Campaign edited" },
  "campaign.status_changed": { es: "Estado de campaña", en: "Campaign status" },
  "campaign.deleted": { es: "Campaña eliminada", en: "Campaign deleted" },
  "upload.establishments": { es: "Carga de establecimientos", en: "Establishments uploaded" },
  "upload.bounces": { es: "Carga de correos rebotados", en: "Bounced emails uploaded" },
  "upload.status": { es: "Carga de estatus SIGTUR", en: "SIGTUR status uploaded" },
  "emails.marked_sent": { es: "Envío de correo registrado", en: "Email send logged" },
  "assignment.run": { es: "Asignación de tareas", en: "Tasks assigned" },
  "task.reassigned": { es: "Tarea reasignada", en: "Task reassigned" },
  "call.logged": { es: "Llamada registrada", en: "Call logged" },
  "call.reviewed": { es: "Llamada revisada", en: "Call reviewed" },
  "task.moved": { es: "Tareas movidas a otra persona", en: "Tasks moved to someone else" },
  "task.covered": { es: "Tareas cubiertas durante una ausencia", en: "Tasks covered during an absence" },
  "absence.added": { es: "Ausencia registrada", en: "Absence added" },
  "absence.deleted": { es: "Ausencia eliminada", en: "Absence deleted" },
  "campaign.script_updated": { es: "Guion de llamada editado", en: "Call script edited" },
  "report.downloaded": { es: "Informe descargado", en: "Report downloaded" },
  "report.generated": { es: "Informe generado", en: "Report generated" },
  "report.template_saved": { es: "Plantilla de informe guardada", en: "Report template saved" },
  "report.template_deleted": { es: "Plantilla de informe eliminada", en: "Report template deleted" },
  "report.deleted": { es: "Informe eliminado", en: "Report deleted" },
  "campaign.from_results": { es: "Campaña creada con resultados de otra", en: "Campaign created from another's results" },
  "integration.key_created": { es: "Clave de integración creada", en: "Integration key created" },
  "integration.key_revoked": { es: "Clave de integración revocada", en: "Integration key revoked" },
  "sigtur.call_request": { es: "Solicitud de llamada desde SIGTUR", en: "Call request from SIGTUR" },
  "sigtur.campaign": { es: "Campaña recibida desde SIGTUR", en: "Campaign received from SIGTUR" },
  "sigtur.requests_on": { es: "Solicitudes SIGTUR encendidas", en: "SIGTUR requests switched on" },
  "sigtur.requests_off": { es: "Solicitudes SIGTUR en pausa", en: "SIGTUR requests paused" },
  "phone.added": { es: "Número agregado", en: "Number added" },
  "visit.logged": { es: "Visita registrada", en: "Visit logged" },
  "tasks.removed": { es: "RUT eliminados de una campaña", en: "RUTs removed from a campaign" },
  "task.to_visit": { es: "Pasada a visita", en: "Sent to visit" },
  "task.followup_scheduled": { es: "Seguimiento programado", en: "Follow-up scheduled" },
  "task.cover_started": { es: "Tareas cubiertas al empezar una ausencia", en: "Tasks covered as an absence starts" },
  "task.cover_returned": { es: "Tareas devueltas tras una ausencia", en: "Tasks handed back after an absence" },
  "sigtur.request_assigned": { es: "Solicitud SIGTUR asignada", en: "SIGTUR request assigned" },
  "sigtur.request_resolved": { es: "Solicitud SIGTUR resuelta", en: "SIGTUR request solved" },
  "sigtur.request_overdue": { es: "Solicitud SIGTUR vencida", en: "SIGTUR request overdue" },
  "sigtur.sent": { es: "Enviado a SIGTUR", en: "Sent to SIGTUR" },
  "sigtur.send_failed": { es: "Error al enviar a SIGTUR", en: "Sending to SIGTUR failed" },
  "sigtur.push_on": { es: "Envío a SIGTUR encendido", en: "Sending to SIGTUR switched on" },
  "sigtur.push_off": { es: "Envío a SIGTUR apagado", en: "Sending to SIGTUR switched off" },
  "sigtur.push_url": { es: "Dirección de SIGTUR guardada", en: "SIGTUR address saved" },
  "sigtur.retry": { es: "Reintento de envío a SIGTUR", en: "SIGTUR sending retried" },
  "sigtur.assignees_saved": { es: "Personas que reciben solicitudes SIGTUR", en: "People receiving SIGTUR requests" },
  "report.template_paused": { es: "Programación de informe pausada / reanudada", en: "Report schedule paused / resumed" },
  "establishment.updated": { es: "Datos del establecimiento actualizados", en: "Establishment details updated" },
  "phone.marked": { es: "Número marcado", en: "Number marked" },
  "export.downloaded": { es: "Descarga de datos", en: "Data downloaded" },
};

export const ERROR_SOURCES: Record<string, L> = {
  server: { es: "Servidor", en: "Server" },
  action: { es: "Acción", en: "Action" },
  browser: { es: "Navegador", en: "Browser" },
};

// Short result labels for compact lists (the full text is shown on hover).
export const CODE_SHORT: Record<string, L> = {
  "01": { es: "Compromiso", en: "Commitment" },
  "02": { es: "Ya inició", en: "Already applied" },
  "03": { es: "Requiere asistencia", en: "Needs help" },
  "04": { es: "Se niega", en: "Refuses" },
  "05": { es: "Cerró", en: "Closed" },
  "06": { es: "Cambió dueño", en: "Changed owner" },
  "07": { es: "Número equivocado", en: "Wrong number" },
  "08": { es: "No contesta", en: "No answer" },
  "09": { es: "Fuera de servicio", en: "Out of service" },
  "10": { es: "Buzón", en: "Voicemail" },
};

// Colour group of a result: good (applying), info, warning (no contact), bad (refuses/closed).
export function codeTone(code: string | null | undefined): "good" | "info" | "warn" | "bad" | "none" {
  if (!code) return "none";
  if (code === "01" || code === "02") return "good";
  if (code === "03" || code === "06") return "info";
  if (code === "04" || code === "05" || code === "09" || code === "07") return "bad";
  return "warn";
}
