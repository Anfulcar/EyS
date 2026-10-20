import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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
    cerradoDesde: text("cerrado_desde"),
    obstaculo: text("obstaculo"),
    extra: text("extra"),
  },
  (t) => [
    uniqueIndex("establishments_campaign_sigtur").on(t.campaignId, t.sigturId),
    index("establishments_company").on(t.companyId),
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
  (t) => [index("phones_company").on(t.companyId)],
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
    notes: text("notes"),
  },
  (t) => [index("attempts_company").on(t.companyId), index("attempts_campaign").on(t.campaignId)],
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
  (t) => [index("results_est").on(t.establishmentId), index("results_campaign").on(t.campaignId)],
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
  (t) => [index("visits_est").on(t.establishmentId)],
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
});

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

export type User = typeof users.$inferSelect;
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
