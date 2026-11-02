import { sql } from "drizzle-orm";
import { blob, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  name: text("name").notNull(),
  // admin | supervisor | agent | inspector
  role: text("role").notNull().default("agent"),
  passwordHash: text("password_hash").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(true),
  failedLogins: integer("failed_logins").notNull().default(0),
  lockedUntil: text("locked_until"),
  // Last time the person opened "Informes generados" (for the "new" counter)
  reportsSeenAt: text("reports_seen_at"),
  // «Permisos por módulo»: access to the call campaigns (administrators always have it)…
  callsAccess: integer("calls_access", { mode: "boolean" }).notNull().default(true),
  // …and level in «Quejas y reclamaciones»: none | register | manage | supervise
  qrLevel: text("qr_level").notNull().default("none"),
  createdAt: text("created_at").notNull().default(now),
});

export const campaigns = sqliteTable("campaigns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  // draft | active | closed
  status: text("status").notNull().default("draft"),
  maxAttempts: integer("max_attempts").notNull().default(3),
  followupDays: integer("followup_days").notNull().default(5),
  // Call script shown to agents (empty = the standard text)
  scriptEs: text("script_es"),
  scriptEn: text("script_en"),
  // standard | sigtur_requests (the always-open campaign that receives SIGTUR call requests)
  // | email («Campaña de correo»: no calls, only the «Correos» work)
  kind: text("kind").notNull().default("standard"),
  // manual | transfer (made from another campaign's results) | sigtur
  source: text("source").notNull().default("manual"),
  sourceRef: text("source_ref"),
  // People who receive tasks automatically by workload (SIGTUR requests), JSON list of user ids
  autoAssignees: text("auto_assignees"),
  // Permanent SIGTUR campaign: when paused, new call requests are refused ("en pausa"); open tasks keep going.
  requestsPaused: integer("requests_paused", { mode: "boolean" }).notNull().default(false),
  pausedBy: integer("paused_by").references(() => users.id),
  pausedAt: text("paused_at"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: text("created_at").notNull().default(now),
});

// One call task per company (grouped by RNC / Cédula) inside a campaign.
export const companies = sqliteTable(
  "companies",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    campaignId: integer("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    razonSocial: text("razon_social"),
    rnc: text("rnc"),
    assignedUserId: integer("assigned_user_id").references(() => users.id),
    // When the task was last (re)assigned: used to count how many days a never-called task has waited.
    assignedAt: text("assigned_at"),
    // Temporary cover during an absence: the task goes back to coverFromUserId when the absence ends.
    coverFromUserId: integer("cover_from_user_id"),
    coverUserId: integer("cover_user_id"),
    coverAbsenceId: integer("cover_absence_id"),
    // Moved to another campaign («Nueva campaña con estas tareas»), or where it came from.
    transferredToCampaignId: integer("transferred_to_campaign_id"),
    originNote: text("origin_note"),
    // Call requested from SIGTUR (shown with its own tag and first in "Para hoy").
    sigturRequest: integer("sigtur_request", { mode: "boolean" }).notNull().default(false),
    requestedBy: text("requested_by"),
    requestReason: text("request_reason"),
    requestedAt: text("requested_at"),
    // SIGTUR's own request number, its deadline (empty = 2 working days), when it was solved and when it went overdue.
    requestRef: text("request_ref"),
    requestDueDate: text("request_due_date"),
    requestResolvedAt: text("request_resolved_at"),
    requestOverdueAt: text("request_overdue_at"),
    // pending | retry | followup | visit | done
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    nextActionAt: text("next_action_at"),
    lastCalledAt: text("last_called_at"),
    lastCode: text("last_code"),
    priority: text("priority"),
    zone: text("zone"),
    whatsappSuggested: integer("whatsapp_suggested", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [
    uniqueIndex("companies_campaign_key").on(t.campaignId, t.key),
    index("companies_assigned").on(t.campaignId, t.assignedUserId, t.status),
    index("companies_user").on(t.assignedUserId),
  ],
);

export const establishments = sqliteTable(
  "establishments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    campaignId: integer("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
    companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    // SIGTUR data (columns 1–27 of the Matriz de seguimiento)
    sigturId: text("sigtur_id").notNull(),
    rut: text("rut"),
    estatusRnt: text("estatus_rnt"),
    prioridad: text("prioridad"),
    nombreComercial: text("nombre_comercial"),
    razonSocial: text("razon_social"),
    rnc: text("rnc"),
    subsector: text("subsector"),
    actividad: text("actividad"),
    provincia: text("provincia"),
    municipio: text("municipio"),
    zonaOperativa: text("zona_operativa"),
    zonaTuristica: text("zona_turistica"),
    direccion: text("direccion"),
    telefono: text("telefono"),
    telefonoValido: text("telefono_valido"),
    correo: text("correo"),
    correoValido: text("correo_valido"),
    contactabilidad: text("contactabilidad"),
    establMismaEmpresa: integer("establ_misma_empresa"),
    establMismoCorreo: integer("establ_mismo_correo"),
    resolucion: text("resolucion"),
    fechaEmision: text("fecha_emision"),
    fechaVencimiento: text("fecha_vencimiento"),
    diasVencida: integer("dias_vencida"),
    tiempoVencida: text("tiempo_vencida"),
    antiguedad: text("antiguedad"),
    // Tracking (columns 28–48)
    correoEnviadoFecha: text("correo_enviado_fecha"),
    correoRebotado: text("correo_rebotado"),
    finalCode: text("final_code"),
    enOperacion: text("en_operacion"),
    fechaCompromiso: text("fecha_compromiso"),
    requiereVisita: text("requiere_visita"),
    estatusSigturActualizado: text("estatus_sigtur_actualizado"),
    fechaCambioEstatus: text("fecha_cambio_estatus"),
    canalLogro: text("canal_logro"),
    responsable: text("responsable"),
    observaciones: text("observaciones"),
    // Extra data captured in calls
    contactoNombre: text("contacto_nombre"),
    contactoCargo: text("contacto_cargo"),
    correoActualizado: text("correo_actualizado"),
    // Last answer to «¿Recibió el correo?» (Sí | No)
    correoRecibido: text("correo_recibido"),
    // Owner / person in charge reported in a call or visit («Actualizar datos»)
    propietario: text("propietario"),
    cerradoDesde: text("cerrado_desde"),
    obstaculo: text("obstaculo"),
    extra: text("extra"),
  },
  (t) => [
    uniqueIndex("establishments_campaign_sigtur").on(t.campaignId, t.sigturId),
    index("establishments_company").on(t.companyId),
    index("establishments_rut").on(t.rut),
  ],
);

export const phones = sqliteTable(
  "phones",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    campaignId: integer("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
    companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    number: text("number").notNull(),
    normalized: text("normalized").notNull(),
    // file | added
    source: text("source").notNull().default("file"),
    // original | substitute | additional
    kind: text("kind").notNull().default("original"),
    reason: text("reason"),
    reasonNote: text("reason_note"),
    replacesPhoneId: integer("replaces_phone_id"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    // ok | invalid | wrong | out_of_service
    quality: text("quality").notNull().default("ok"),
    addedBy: integer("added_by").references(() => users.id),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("phones_company").on(t.companyId), index("phones_campaign").on(t.campaignId)],
);

export const callAttempts = sqliteTable(
  "call_attempts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    campaignId: integer("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
    companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => users.id),
    phoneId: integer("phone_id"),
    phoneNumber: text("phone_number"),
    calledAt: text("called_at").notNull(),
    attemptNo: integer("attempt_no").notNull(),
    contacted: integer("contacted", { mode: "boolean" }).notNull(),
    attended: integer("attended", { mode: "boolean" }),
    noContactCode: text("no_contact_code"),
    spokeWith: text("spoke_with"),
    spokeRole: text("spoke_role"),
    isResponsible: integer("is_responsible", { mode: "boolean" }),
    whatsappSent: integer("whatsapp_sent", { mode: "boolean" }).notNull().default(false),
    // «¿Recibió el correo?» Sí | No (asked when the agent spoke with someone; empty = not asked)
    emailReceived: text("email_received"),
    notes: text("notes"),
    // Review by a supervisor or administrator
    reviewedAt: text("reviewed_at"),
    reviewedBy: integer("reviewed_by").references(() => users.id),
    reviewComment: text("review_comment"),
  },
  (t) => [index("attempts_company").on(t.companyId), index("attempts_campaign").on(t.campaignId), index("attempts_called_at").on(t.calledAt), index("attempts_user").on(t.userId)],
);

// Result of an attempt for each establishment of the company ("se tipifica cada establecimiento").
export const callResults = sqliteTable(
  "call_results",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    attemptId: integer("attempt_id").notNull().references(() => callAttempts.id, { onDelete: "cascade" }),
    campaignId: integer("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
    establishmentId: integer("establishment_id").notNull().references(() => establishments.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    enOperacion: text("en_operacion"),
    commitmentDate: text("commitment_date"),
    closedSince: text("closed_since"),
    obstacle: text("obstacle"),
    notes: text("notes"),
  },
  (t) => [index("results_est").on(t.establishmentId), index("results_campaign").on(t.campaignId), index("results_attempt").on(t.attemptId)],
);

export const visits = sqliteTable(
  "visits",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    campaignId: integer("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
    establishmentId: integer("establishment_id").notNull().references(() => establishments.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => users.id),
    visitNo: integer("visit_no").notNull(),
    visitDate: text("visit_date").notNull(),
    code: text("code").notNull(),
    commitmentDate: text("commitment_date"),
    notes: text("notes"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("visits_est").on(t.establishmentId), index("visits_campaign").on(t.campaignId)],
);

export const statusChanges = sqliteTable("status_changes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: integer("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  establishmentId: integer("establishment_id").notNull().references(() => establishments.id, { onDelete: "cascade" }),
  oldStatus: text("old_status"),
  newStatus: text("new_status").notNull(),
  changedAt: text("changed_at").notNull(),
  userId: integer("user_id").references(() => users.id),
  createdAt: text("created_at").notNull().default(now),
}, (t) => [index("status_changes_campaign").on(t.campaignId)]);

export const importLogs = sqliteTable("import_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }),
  // establishments | status | bounces
  kind: text("kind").notNull(),
  fileName: text("file_name"),
  rows: integer("rows").notNull().default(0),
  inserted: integer("inserted").notNull().default(0),
  updated: integer("updated").notNull().default(0),
  skipped: integer("skipped").notNull().default(0),
  userId: integer("user_id").references(() => users.id),
  createdAt: text("created_at").notNull().default(now),
});

// Vacations, days off and unavailability (whole days, local dates).
export const absences = sqliteTable(
  "absences",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    fromDate: text("from_date").notNull(),
    toDate: text("to_date").notNull(),
    // vacation | day_off | unavailable
    kind: text("kind").notNull(),
    note: text("note"),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("absences_user").on(t.userId)],
);

// Saved report choices ("plantillas"), optionally generated on a schedule.
export const reportTemplates = sqliteTable("report_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  // JSON: ReportOptions (campaigns, relative period, title, comments, sections, format…)
  options: text("options").notNull(),
  // none | weekly | biweekly | monthly
  frequency: text("frequency").notNull().default("none"),
  // weekly/biweekly: 1 = Monday … 7 = Sunday; monthly: day of month 1–28
  runDay: integer("run_day"),
  nextRunOn: text("next_run_on"),
  paused: integer("paused", { mode: "boolean" }).notNull().default(false),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: text("created_at").notNull().default(now),
});

// Report files kept for 12 months (scheduled ones, and "Generar ahora").
export const generatedReports = sqliteTable(
  "generated_reports",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    templateId: integer("template_id"),
    name: text("name").notNull(),
    periodLabel: text("period_label"),
    format: text("format").notNull(),
    fileName: text("file_name").notNull(),
    content: blob("content", { mode: "buffer" }).notNull(),
    // scheduled | manual
    source: text("source").notNull(),
    createdBy: integer("created_by"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("generated_reports_at").on(t.createdAt)],
);

// Keys that let SIGTUR use the app's integration door (only a hash is stored).
export const apiKeys = sqliteTable("api_keys", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  prefix: text("prefix").notNull(),
  hash: text("hash").notNull().unique(),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: text("created_at").notNull().default(now),
  lastUsedAt: text("last_used_at"),
  revokedAt: text("revoked_at"),
});

// What SIGTUR sent or read, and whether it worked («Integraciones»).
export const integrationLog = sqliteTable(
  "integration_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    at: text("at").notNull().default(now),
    keyId: integer("key_id"),
    // call_request | campaign | interactions
    kind: text("kind").notNull(),
    ok: integer("ok", { mode: "boolean" }).notNull(),
    summary: text("summary"),
  },
  (t) => [index("integration_log_at").on(t.at)],
);

export type User = typeof users.$inferSelect;
export type Absence = typeof absences.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type Establishment = typeof establishments.$inferSelect;
export type Phone = typeof phones.$inferSelect;
export type CallAttempt = typeof callAttempts.$inferSelect;
export type CallResult = typeof callResults.$inferSelect;
export type Visit = typeof visits.$inferSelect;

// Small key/value table for app-level markers (e.g. mode = "demo" on the preview database).
export const appMeta = sqliteTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// Who did what, when (visible to administrators).
export const activityLog = sqliteTable(
  "activity_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    at: text("at").notNull().default(now),
    userId: integer("user_id"),
    userName: text("user_name"),
    action: text("action").notNull(),
    campaignId: integer("campaign_id"),
    entity: text("entity"),
    entityId: text("entity_id"),
    summary: text("summary"),
    ip: text("ip"),
  },
  (t) => [index("activity_at").on(t.at), index("activity_action").on(t.action)],
);

// Errors on the server or in the browser (visible to administrators).
export const errorLog = sqliteTable(
  "error_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    at: text("at").notNull().default(now),
    source: text("source").notNull(),
    userId: integer("user_id"),
    path: text("path"),
    message: text("message").notNull(),
    digest: text("digest"),
    detail: text("detail"),
  },
  (t) => [index("errors_at").on(t.at)],
);

// Everything waiting to go to SIGTUR (interactions, change requests, solved requests). Kept even when sending is off.
export const sigturOutbox = sqliteTable(
  "sigtur_outbox",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    // interaction | change | resolved
    kind: text("kind").notNull(),
    // Stable identifier SIGTUR can use to spot repeats (e.g. llamada-12, cambio-5)
    ref: text("ref").notNull(),
    sigturId: text("sigtur_id"),
    summary: text("summary"),
    payload: text("payload").notNull(),
    // pending | sent | error
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    nextTryAt: text("next_try_at"),
    createdAt: text("created_at").notNull().default(now),
    sentAt: text("sent_at"),
  },
  (t) => [uniqueIndex("sigtur_outbox_ref").on(t.ref), index("sigtur_outbox_status").on(t.status, t.id)],
);

// Commitments and closures of campaigns that were deleted, so the warnings survive (live campaigns are read directly).
export const historyArchive = sqliteTable(
  "history_archive",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    // commitment | closed
    kind: text("kind").notNull(),
    rut: text("rut"),
    rnc: text("rnc"),
    sigturId: text("sigtur_id"),
    establishment: text("establishment"),
    campaignName: text("campaign_name").notNull(),
    // Commitment date, or "closed since" (free text such as 2023 or 03/2026)
    date: text("date"),
    // How it was recorded, e.g. "Llamada 01" or "Visita V4"
    source: text("source"),
    byName: text("by_name"),
    at: text("at"),
  },
  (t) => [index("history_archive_rut").on(t.rut), index("history_archive_rnc").on(t.rnc)],
);

// RUTs removed from a campaign (the task and its calls are deleted; this record stays, with the reason).
export const removedTasks = sqliteTable(
  "removed_tasks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    campaignId: integer("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
    rut: text("rut"),
    sigturId: text("sigtur_id"),
    establishment: text("establishment"),
    rnc: text("rnc"),
    lastStatus: text("last_status"),
    calls: integer("calls").notNull().default(0),
    visits: integer("visits").notNull().default(0),
    reason: text("reason").notNull(),
    removedBy: integer("removed_by").references(() => users.id),
    removedByName: text("removed_by_name"),
    removedAt: text("removed_at").notNull().default(now),
  },
  (t) => [index("removed_tasks_campaign").on(t.campaignId)],
);

// «Reporte de cambios»: every data change a person made to an establishment (call, visit, or the history before
// this record existed), so it can be updated in SIGTUR by hand. Copies the names so it survives deletions.
export const dataChanges = sqliteTable(
  "data_changes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    establishmentId: integer("establishment_id").references(() => establishments.id, { onDelete: "set null" }),
    campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    campaignName: text("campaign_name"),
    rut: text("rut"),
    sigturId: text("sigtur_id"),
    establishment: text("establishment"),
    field: text("field").notNull(),
    label: text("label").notNull(),
    fromValue: text("from_value"),
    toValue: text("to_value"),
    byUserId: integer("by_user_id").references(() => users.id, { onDelete: "set null" }),
    byName: text("by_name"),
    // Llamada | Visita | Histórico
    source: text("source").notNull(),
    at: text("at").notNull().default(now),
    // true when the date is the establishment's last call (changes made before this record existed)
    approximate: integer("approximate", { mode: "boolean" }).notNull().default(false),
    // Marked «Actualizado en SIGTUR» by a manager after updating SIGTUR by hand
    sigturDoneAt: text("sigtur_done_at"),
    sigturDoneBy: integer("sigtur_done_by").references(() => users.id, { onDelete: "set null" }),
    sigturDoneByName: text("sigtur_done_by_name"),
  },
  (t) => [index("data_changes_at").on(t.at), index("data_changes_campaign").on(t.campaignId), index("data_changes_est").on(t.establishmentId)],
);

// ---------- «Quejas y reclamaciones» (a separate module) ----------

// One file per complaint, claim, report or suggestion. «Involucrado» = who it is about (a SIGTUR RUT or typed
// details); «Presentado por» = who brings it (may be anonymous).
export const qrCases = sqliteTable(
  "qr_cases",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    // QR-2026-0001
    number: text("number").notNull().unique(),
    year: integer("year").notNull(),
    seq: integer("seq").notNull(),
    // Queja | Reclamación | Denuncia | Sugerencia
    type: text("type").notNull(),
    topic: text("topic"),
    // web | sigtur | app | phone | email | office | historic
    channel: text("channel").notNull(),
    // Alta | Media | Baja
    priority: text("priority").notNull().default("Media"),
    // recibida | analisis | referida | espera | porcerrar | cerrada
    status: text("status").notNull().default("recibida"),
    assignedUserId: integer("assigned_user_id").references(() => users.id, { onDelete: "set null" }),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
    // Deadlines (local days), fixed when the case is created from «Configuración del módulo»
    firstDue: text("first_due").notNull(),
    due: text("due").notNull(),
    firstDoneAt: text("first_done_at"),
    subject: text("subject").notNull(),
    description: text("description").notNull(),
    solution: text("solution"),
    partySigtur: integer("party_sigtur", { mode: "boolean" }).notNull().default(false),
    partyRut: text("party_rut"),
    partySigturId: text("party_sigtur_id"),
    partyName: text("party_name").notNull(),
    partyRazon: text("party_razon"),
    partyRnc: text("party_rnc"),
    partyRntStatus: text("party_rnt_status"),
    partyProvince: text("party_province"),
    partyMunicipality: text("party_municipality"),
    partyAddress: text("party_address"),
    partyPhone: text("party_phone"),
    partyEmail: text("party_email"),
    complainantAnonymous: integer("complainant_anonymous", { mode: "boolean" }).notNull().default(false),
    complainantName: text("complainant_name"),
    complainantDoc: text("complainant_doc"),
    complainantNationality: text("complainant_nationality"),
    complainantPhone: text("complainant_phone"),
    complainantEmail: text("complainant_email"),
    closeProposedBy: integer("close_proposed_by").references(() => users.id, { onDelete: "set null" }),
    closeProposedAt: text("close_proposed_at"),
    closeNote: text("close_note"),
    closedBy: integer("closed_by").references(() => users.id, { onDelete: "set null" }),
    closedAt: text("closed_at"),
    // SIGTUR's own reference, or the old case number of a historical upload
    sourceRef: text("source_ref"),
    // Public form: a fingerprint of the sender's address, only to limit repeated sending
    senderHash: text("sender_hash"),
  },
  (t) => [index("qr_cases_status").on(t.status), index("qr_cases_assigned").on(t.assignedUserId), index("qr_cases_rut").on(t.partyRut), index("qr_cases_created").on(t.createdAt)],
);

// «Pasos dados»: never edited or deleted. public = can be told to the person and goes in the report.
export const qrSteps = sqliteTable(
  "qr_steps",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    caseId: integer("case_id").notNull().references(() => qrCases.id, { onDelete: "cascade" }),
    at: text("at").notNull().default(now),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    byName: text("by_name"),
    // public | internal | system
    kind: text("kind").notNull(),
    text: text("text").notNull(),
  },
  (t) => [index("qr_steps_case").on(t.caseId)],
);

// «Referencias»: the case was sent to another institution or area.
export const qrReferrals = sqliteTable(
  "qr_referrals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    caseId: integer("case_id").notNull().references(() => qrCases.id, { onDelete: "cascade" }),
    institution: text("institution").notNull(),
    sentOn: text("sent_on").notNull(),
    dueOn: text("due_on"),
    note: text("note"),
    response: text("response"),
    respondedAt: text("responded_at"),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("qr_referrals_case").on(t.caseId)],
);

// «Pruebas»: files are kept in pieces (each upload request stays small); never deleted, only marked replaced.
export const qrFiles = sqliteTable(
  "qr_files",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    caseId: integer("case_id").notNull().references(() => qrCases.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    parts: integer("parts").notNull(),
    // true once every piece arrived
    complete: integer("complete", { mode: "boolean" }).notNull().default(false),
    uploadedBy: integer("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    uploadedByName: text("uploaded_by_name"),
    at: text("at").notNull().default(now),
    replacedAt: text("replaced_at"),
  },
  (t) => [index("qr_files_case").on(t.caseId)],
);

export const qrFileParts = sqliteTable(
  "qr_file_parts",
  {
    fileId: integer("file_id").notNull().references(() => qrFiles.id, { onDelete: "cascade" }),
    idx: integer("idx").notNull(),
    data: blob("data", { mode: "buffer" }).notNull(),
  },
  (t) => [uniqueIndex("qr_file_parts_pk").on(t.fileId, t.idx)],
);

// «Informes»: one PDF per version (automatic at closing, or on request).
export const qrReports = sqliteTable(
  "qr_reports",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    caseId: integer("case_id").notNull().references(() => qrCases.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    // auto | request
    origin: text("origin").notNull(),
    byName: text("by_name"),
    createdAt: text("created_at").notNull().default(now),
    pdf: blob("pdf", { mode: "buffer" }).notNull(),
  },
  (t) => [index("qr_reports_case").on(t.caseId)],
);

export type QrCase = typeof qrCases.$inferSelect;
