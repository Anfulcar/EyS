"use server";

import bcrypt from "bcryptjs";
import { and, eq, inArray, isNull, ne, notInArray } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { absences, apiKeys, campaigns, companies, establishments, generatedReports, importLogs, phones, reportTemplates, users } from "@/db/schema";
import { logActivity, logError } from "@/lib/audit";
import { assertUser, clearSession, homeFor, MANAGERS, recentlyAuthenticated, setSessionCookie } from "@/lib/auth";
import { CLOSED_STATUSES, CALL_CODES, PHONE_KINDS, PHONE_REASONS, ROLES, SIGTUR_STATUSES, VISIT_CODES } from "@/lib/catalog";
import { nowIso, toIsoDate, todayLocal } from "@/lib/dates";
import { DICTS } from "@/lib/i18n";
import { getDict } from "@/lib/i18n-server";
import { buildRecords, commitImport, previewImport } from "@/lib/importer";
import { cleanOptions, firstRun, FREQUENCIES, type Frequency } from "@/lib/report-options";
import { generateAndStore } from "@/lib/report-run";
import { reviewCall } from "@/lib/reviews";
import { archiveCampaignHistory } from "@/lib/history";
import { idsByFilters, idsByKeys, MAX_REMOVE, previewRemoval, removeTasks, type RemovalPreview } from "@/lib/remove";
import { cleanTaskFilters } from "@/lib/task-filters";
import { flushOutbox, queueCallInteractions, queueChanges, queueEmailInteractions, queueVisitInteraction, resolveRequest, retryFailed, setPushEnabled, setPushUrl, pushSettings, validPushUrl } from "@/lib/sigtur-push";
import { createApiKey, logIntegration, parseCallRequest, receiveCallRequest, REQUESTS_CAMPAIGN, requestsCampaign, setAutoAssignees, setRequestsPaused } from "@/lib/sigtur";
import { countTransfer, transferToNewCampaign, type TransferFilter } from "@/lib/transfer";
import { ABSENCE_KINDS, coverTasks, distribute, moveTasks, syncCoverage, workload } from "@/lib/team";
import { formatPhone, normalizePhone, readTable, str } from "@/lib/sheets";
import { applyStatusUpdates, canWorkCompany, logCall, logVisit, relatedTasks, type CallInput, type CallOutcome } from "@/lib/workflow";

// keep: the message stays in the form (a password, a key, an import summary) instead of the passing notice.
export type ActionState = { ok?: boolean; error?: string; message?: string; keep?: boolean; data?: unknown; needsReauth?: boolean } | null;

// ---------- Session ----------

export async function loginAction(form: FormData) {
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const u = await db.query.users.findFirst({ where: eq(users.username, username) });
  if (!u || !u.active) {
    await logActivity(null, "login.failed", { entity: "user", summary: `Usuario: ${username.slice(0, 40)} (no existe o inactivo)` });
    redirect("/login?error=1");
  }
  if (u.lockedUntil && u.lockedUntil > nowIso()) {
    await logActivity(u, "login.locked", { entity: "user", entityId: u.id, summary: `Intento durante el bloqueo: ${u.username}` });
    redirect("/login?error=locked");
  }
  const ok = await bcrypt.compare(password, u.passwordHash);
  if (!ok) {
    const failed = u.failedLogins + 1;
    await db
      .update(users)
      .set({ failedLogins: failed >= 5 ? 0 : failed, lockedUntil: failed >= 5 ? new Date(Date.now() + 15 * 60000).toISOString() : null })
      .where(eq(users.id, u.id));
    await logActivity(u, failed >= 5 ? "login.locked" : "login.failed", { entity: "user", entityId: u.id, summary: `${u.username}: contraseña incorrecta (${failed}/5)` });
    redirect(failed >= 5 ? "/login?error=locked" : "/login?error=1");
  }
  await db.update(users).set({ failedLogins: 0, lockedUntil: null }).where(eq(users.id, u.id));
  await setSessionCookie(u);
  await logActivity(u, "login.success", { entity: "user", entityId: u.id, summary: u.username });
  redirect(u.mustChangePassword ? "/account?force=1" : homeFor(u.role));
}

export async function logoutAction() {
  const { currentUser } = await import("@/lib/auth");
  const u = await currentUser();
  if (u) await logActivity(u, "logout", { entity: "user", entityId: u.id });
  await clearSession();
  redirect("/login");
}

export async function setLangAction(form: FormData) {
  const lang = form.get("lang") === "en" ? "en" : "es";
  (await cookies()).set("lang", lang, { path: "/", maxAge: 365 * 86400, sameSite: "lax" });
  revalidatePath("/", "layout");
}

export async function changePasswordAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { t } = await getDict();
  const { currentUser } = await import("@/lib/auth");
  const u = await currentUser();
  if (!u) redirect("/login");
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  if (next.length < 8) return { error: t.passwordTooShort };
  if (next !== String(form.get("confirm") ?? "")) return { error: t.passwordMismatch };
  if (!(await bcrypt.compare(current, u.passwordHash))) return { error: t.wrongPassword };
  await db.update(users).set({ passwordHash: await bcrypt.hash(next, 10), mustChangePassword: false }).where(eq(users.id, u.id));
  await setSessionCookie({ ...u, mustChangePassword: false });
  await logActivity(u, "password.changed", { entity: "user", entityId: u.id, summary: u.mustChangePassword ? "Cambio obligatorio del primer ingreso" : "Cambio voluntario" });
  if (u.mustChangePassword) redirect(homeFor(u.role));
  revalidatePath("/account");
  return { ok: true, message: t.passwordChanged };
}

// Sensitive actions answer this when the password must be typed again.
async function reauthRequired(): Promise<ActionState | null> {
  if (await recentlyAuthenticated()) return null;
  const { t } = await getDict();
  return { needsReauth: true, error: t.reauthNeeded };
}

export async function reauthAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { t } = await getDict();
  const { currentUser } = await import("@/lib/auth");
  const u = await currentUser();
  if (!u) redirect("/login");
  if (!(await bcrypt.compare(String(form.get("password") ?? ""), u.passwordHash))) {
    const failed = u.failedLogins + 1;
    await db
      .update(users)
      .set({ failedLogins: failed >= 5 ? 0 : failed, lockedUntil: failed >= 5 ? new Date(Date.now() + 15 * 60000).toISOString() : null })
      .where(eq(users.id, u.id));
    await logActivity(u, failed >= 5 ? "login.locked" : "login.failed", { entity: "user", entityId: u.id, summary: `${u.username}: contraseña incorrecta al confirmar una acción (${failed}/5)` });
    if (failed >= 5) {
      await clearSession();
      redirect("/login?error=locked");
    }
    return { error: t.wrongPassword };
  }
  await db.update(users).set({ failedLogins: 0, lockedUntil: null }).where(eq(users.id, u.id));
  await setSessionCookie(u);
  await logActivity(u, "login.reauth", { entity: "user", entityId: u.id, summary: u.username });
  return { ok: true };
}

// ---------- Users ----------

const USERNAME_RE = /^[a-z0-9._-]{3,40}$/;

// Default temporary password: "<username>123". Users must change it at first login.
function defaultPassword(username: string) {
  return `${username}123`;
}

export async function createUserAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertUser(["admin"]);
  const reauth = await reauthRequired();
  if (reauth) return reauth;
  const { t } = await getDict();
  const parsed = z
    .object({
      username: z.string().trim().toLowerCase().regex(USERNAME_RE),
      name: z.string().trim().min(2).max(80),
      role: z.enum(Object.keys(ROLES) as [string, ...string[]]),
      password: z.string().optional().default(""),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const exists = await db.query.users.findFirst({ where: eq(users.username, parsed.data.username) });
  if (exists) return { error: t.usernameTaken };
  const password = parsed.data.password.trim() || defaultPassword(parsed.data.username);
  const [created] = await db.insert(users).values({
    username: parsed.data.username,
    name: parsed.data.name,
    role: parsed.data.role,
    passwordHash: await bcrypt.hash(password, 10),
    mustChangePassword: true,
  }).returning({ id: users.id });
  await logActivity(me, "user.created", { entity: "user", entityId: created.id, summary: `${parsed.data.username} (${parsed.data.role})` });
  revalidatePath("/users");
  return { ok: true, keep: true, message: `${t.saved}: ${parsed.data.username} / ${password}` };
}

export async function editUserAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertUser(["admin"]);
  const { t } = await getDict();
  const parsed = z
    .object({
      id: z.coerce.number().int(),
      username: z.string().trim().toLowerCase().regex(USERNAME_RE),
      name: z.string().trim().min(2).max(80),
      role: z.enum(Object.keys(ROLES) as [string, ...string[]]),
      active: z.enum(["1", "0"]),
      password: z.string().optional().default(""),
      resetDefault: z.string().optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const d = parsed.data;
  const target = await db.query.users.findFirst({ where: eq(users.id, d.id) });
  if (!target) return { error: "Not found" };
  if (d.username !== target.username) {
    const taken = await db.query.users.findFirst({ where: eq(users.username, d.username) });
    if (taken) return { error: t.usernameTaken };
  }
  const sensitive =
    !!d.resetDefault || !!d.password.trim() || d.username !== target.username ||
    (d.id !== me.id && (d.role !== target.role || (d.active === "1") !== target.active));
  if (sensitive) {
    const reauth = await reauthRequired();
    if (reauth) return reauth;
  }
  const set: Partial<typeof users.$inferInsert> = { username: d.username, name: d.name };
  // An admin cannot demote or deactivate themselves (avoids locking everyone out).
  if (d.id !== me.id) {
    set.role = d.role;
    set.active = d.active === "1";
  }
  let newPassword: string | null = null;
  if (d.resetDefault) newPassword = defaultPassword(d.username);
  else if (d.password.trim()) newPassword = d.password.trim();
  if (newPassword) {
    set.passwordHash = await bcrypt.hash(newPassword, 10);
    set.mustChangePassword = true;
    set.failedLogins = 0;
    set.lockedUntil = null;
  }
  await db.update(users).set(set).where(eq(users.id, d.id));
  const who = { entity: "user", entityId: d.id };
  if (set.role && set.role !== target.role) await logActivity(me, "user.role_changed", { ...who, summary: `${d.username}: ${target.role} → ${set.role}` });
  if (set.active != null && set.active !== target.active) await logActivity(me, "user.status_changed", { ...who, summary: `${d.username}: ${set.active ? "activado" : "desactivado"}` });
  if (newPassword) await logActivity(me, "user.password_reset", { ...who, summary: `${d.username}${d.resetDefault ? " (contraseña predeterminada)" : ""}` });
  if (d.username !== target.username || d.name !== target.name) await logActivity(me, "user.updated", { ...who, summary: `${target.username} → ${d.username}, ${d.name}` });
  revalidatePath("/users");
  return { ok: true, keep: !!newPassword, message: newPassword ? `${t.saved}. ${t.password}: ${newPassword}` : t.saved };
}

// ---------- Campaigns ----------

const campaignSchema = z
  .object({
    name: z.string().trim().min(3).max(120),
    description: z.string().trim().max(2000).optional().default(""),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    maxAttempts: z.coerce.number().int().min(1).max(10),
    followupDays: z.coerce.number().int().min(1).max(30),
  })
  .refine((v) => v.endDate >= v.startDate, { message: "endDate < startDate", path: ["endDate"] });

export async function createCampaignAction(_: ActionState, form: FormData): Promise<ActionState> {
  const u = await assertUser(["admin"]);
  const parsed = campaignSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const [c] = await db.insert(campaigns).values({ ...parsed.data, status: "active", createdBy: u.id }).returning();
  await logActivity(u, "campaign.created", { campaignId: c.id, entity: "campaign", entityId: c.id, summary: c.name });
  redirect(`/campaigns/${c.id}/import`);
}

export async function updateCampaignAction(_: ActionState, form: FormData): Promise<ActionState> {
  const u = await assertUser(["admin"]);
  const { t } = await getDict();
  const id = Number(form.get("id"));
  const parsed = campaignSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  await db.update(campaigns).set(parsed.data).where(eq(campaigns.id, id));
  await logActivity(u, "campaign.updated", { campaignId: id, entity: "campaign", entityId: id, summary: `${parsed.data.name} (${parsed.data.startDate} – ${parsed.data.endDate})` });
  revalidatePath(`/campaigns/${id}`, "layout");
  return { ok: true, message: t.saved };
}

export async function setCampaignStatusAction(form: FormData) {
  const u = await assertUser(["admin"]);
  const id = Number(form.get("id"));
  const status = String(form.get("status"));
  if (!["draft", "active", "closed"].includes(status)) return;
  // The permanent SIGTUR campaign is never closed; it is switched on/off instead.
  const target = await db.query.campaigns.findFirst({ where: eq(campaigns.id, id) });
  if (!target || target.kind === "sigtur_requests") return;
  await db.update(campaigns).set({ status }).where(eq(campaigns.id, id));
  await logActivity(u, "campaign.status_changed", { campaignId: id, entity: "campaign", entityId: id, summary: status });
  revalidatePath(`/campaigns/${id}`, "layout");
  revalidatePath("/campaigns");
}

export async function deleteCampaignAction(_: ActionState, form: FormData): Promise<ActionState> {
  const u = await assertUser(["admin"]);
  const reauth = await reauthRequired();
  if (reauth) return reauth;
  const id = Number(form.get("id"));
  const c = await db.query.campaigns.findFirst({ where: eq(campaigns.id, id) });
  if (!c) return { error: "Not found" };
  if (c.kind === "sigtur_requests") return { error: (await getDict()).t.sigturPermanentLocked };
  // Commitments and closures stay as history for the warnings in later campaigns.
  await archiveCampaignHistory(id);
  await db.delete(campaigns).where(eq(campaigns.id, id));
  await logActivity(u, "campaign.deleted", { entity: "campaign", entityId: id, summary: c.name });
  redirect("/campaigns");
}

// ---------- Bulk upload ----------

const WANTED = ["ID SIGTUR", "Identificador"];

export async function previewUploadAction(_: ActionState, form: FormData): Promise<ActionState> {
  await assertUser(MANAGERS);
  const campaignId = Number(form.get("campaignId"));
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "No file" };
  try {
    const { headers, rows } = await readTable(file, WANTED, "Matriz de seguimiento");
    if (!headers.length) return { error: "No se encontró la fila de encabezados (ID SIGTUR) / Header row (ID SIGTUR) not found" };
    const b = buildRecords(headers, rows);
    const p = await previewImport(campaignId, b.records);
    return {
      ok: true,
      data: {
        fileName: file.name,
        rows: rows.length,
        valid: b.records.length,
        mapping: b.mapping,
        ignored: b.ignored,
        missing: b.missing,
        errors: b.errors.slice(0, 50),
        errorCount: b.errors.length,
        duplicates: b.duplicates.slice(0, 50),
        duplicateCount: b.duplicates.length,
        sample: b.records.slice(0, 5),
        ...p,
      },
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function commitUploadAction(_: ActionState, form: FormData): Promise<ActionState> {
  const u = await assertUser(MANAGERS);
  const { t } = await getDict();
  const campaignId = Number(form.get("campaignId"));
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "No file" };
  const { headers, rows } = await readTable(file, WANTED, "Matriz de seguimiento");
  const b = buildRecords(headers, rows);
  if (b.missing.length) return { error: `${t.missingRequired}: ${b.missing.join(", ")}` };
  const mapped = new Set<string>();
  const { MATRIX_COLUMNS } = await import("@/lib/catalog");
  for (const target of Object.values(b.mapping)) {
    const f = MATRIX_COLUMNS.find((c) => c.header === target)?.field;
    if (f) mapped.add(f);
  }
  const r = await commitImport(campaignId, b.records, mapped);
  await db.insert(importLogs).values({ campaignId, kind: "establishments", fileName: file.name, rows: rows.length, inserted: r.inserted, updated: r.updated, skipped: b.errors.length, userId: u.id });
  await logActivity(u, "upload.establishments", { campaignId, entity: "file", summary: `${file.name}: ${r.inserted} nuevos, ${r.updated} actualizados, ${b.errors.length} omitidos` });
  revalidatePath(`/campaigns/${campaignId}`, "layout");
  return { ok: true, keep: true, message: `${t.importDone}: ${r.inserted} ${t.inserted}, ${r.updated} ${t.updated}, ${b.errors.length} ${t.skipped}. ${r.companies} ${t.companies.toLowerCase()}.` };
}

// ---------- Assignment ----------

export async function assignAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertUser(MANAGERS);
  const { t } = await getDict();
  const campaignId = Number(form.get("campaignId"));
  const strategy = String(form.get("strategy"));
  const scope = String(form.get("scope"));
  const agentIds = form.getAll("agents").map(Number).filter(Boolean);
  const zoneMap = new Map<string, number>();
  for (const [k, v] of form.entries()) if (k.startsWith("zone:") && v) zoneMap.set(k.slice(5), Number(v));
  if (strategy !== "zone" && agentIds.length === 0) return { error: t.agents };

  const where = [eq(companies.campaignId, campaignId)];
  if (scope === "unassigned") where.push(isNull(companies.assignedUserId));
  else if (scope === "notStarted") where.push(eq(companies.status, "pending"));
  else where.push(notInArray(companies.status, CLOSED_STATUSES));
  const list = await db.select().from(companies).where(and(...where));
  const sizes = await db.select({ companyId: establishments.companyId }).from(establishments).where(eq(establishments.campaignId, campaignId));
  const size = new Map<number, number>();
  for (const s of sizes) size.set(s.companyId, (size.get(s.companyId) ?? 0) + 1);
  // "Considerar la carga actual": everyone starts from the open work they already have in active campaigns
  // (the tasks being handed out now don't count for their current owner).
  const byWorkload = form.get("workload") === "on";

  const assignment = new Map<number, number>();
  if (strategy === "zone") {
    for (const c of list) {
      const a = zoneMap.get(c.zone ?? "—");
      if (a) assignment.set(c.id, a);
    }
  } else if (strategy === "single") {
    for (const c of list) assignment.set(c.id, agentIds[0]);
  } else {
    // Balanced: tasks of the same company (RNC) stay together with one agent; highest priority and
    // biggest groups first, each group to the agent with the lowest load.
    const start = byWorkload ? await workload(agentIds, list.map((c) => c.id)) : undefined;
    for (const [cid, a] of distribute(list, agentIds, size, start)) assignment.set(cid, a);
  }
  const byAgent = new Map<number, number[]>();
  for (const [cid, a] of assignment) byAgent.set(a, [...(byAgent.get(a) ?? []), cid]);
  for (const [a, ids] of byAgent) {
    for (let i = 0; i < ids.length; i += 500) {
      await db.update(companies).set({ assignedUserId: a, assignedAt: nowIso() }).where(inArray(companies.id, ids.slice(i, i + 500)));
    }
  }
  await logActivity(me, "assignment.run", { campaignId, summary: `${assignment.size} tareas · método: ${strategy}${strategy === "roundRobin" && byWorkload ? " (con carga actual)" : ""} · alcance: ${scope}` });
  revalidatePath(`/campaigns/${campaignId}`, "layout");
  return { ok: true, message: `${assignment.size} ${t.assignedCount}` };
}

export async function reassignCompanyAction(form: FormData) {
  const me = await assertUser(MANAGERS);
  const id = Number(form.get("companyId"));
  const userId = Number(form.get("userId")) || null;
  const [c] = await db.update(companies).set({ assignedUserId: userId, assignedAt: nowIso() }).where(eq(companies.id, id)).returning();
  const to = userId ? await db.query.users.findFirst({ where: eq(users.id, userId) }) : null;
  if (c) await logActivity(me, "task.reassigned", { campaignId: c.campaignId, entity: "task", entityId: id, summary: `${c.key} → ${to?.name ?? "sin asignar"}` });
  revalidatePath("/campaigns", "layout");
}

export async function bulkAssignAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertUser(MANAGERS);
  const { t } = await getDict();
  const campaignId = Number(form.get("campaignId"));
  const ids = form.getAll("ids").map(Number).filter(Boolean);
  const userId = Number(form.get("userId")) || null;
  if (!ids.length) return { error: t.assignSelected };
  const updated = await db
    .update(companies)
    .set({ assignedUserId: userId, assignedAt: nowIso() })
    .where(and(eq(companies.campaignId, campaignId), inArray(companies.id, ids)))
    .returning({ id: companies.id });
  const to = userId ? await db.query.users.findFirst({ where: eq(users.id, userId) }) : null;
  await logActivity(me, "task.reassigned", { campaignId, summary: `${updated.length} tareas seleccionadas → ${to?.name ?? "sin asignar"}` });
  revalidatePath(`/campaigns/${campaignId}`, "layout");
  return { ok: true, message: `${updated.length} ${t.assignedCount}` };
}

// ---------- Calls ----------

export async function logCallAction(_: ActionState, form: FormData): Promise<ActionState> {
  const u = await assertUser(["admin", "supervisor", "agent"]);
  const { lang } = await getDict();
  const t = DICTS[lang];
  try {
    const input = JSON.parse(String(form.get("payload"))) as CallInput;
    if (!input.contacted && !(input.noContactCode && CALL_CODES[input.noContactCode] && !CALL_CODES[input.noContactCode].contacted)) {
      return { error: t.qNoContactReason };
    }
    if (input.contacted && input.attended !== false) {
      if (!input.results.length || input.results.some((r) => !CALL_CODES[r.code]?.contacted)) return { error: t.qResponse };
    }
    // The time of the call is always the moment it is saved (agents can't type or change it).
    input.calledAt = nowIso();
    // The same call can be logged on sibling tasks (same RNC) that the user is allowed to work.
    const main = await canWorkCompany(u, input.companyId);
    if (!main) return { error: "Not found" };
    // A task moved to another campaign is worked there, not here.
    if (main.status === "transferred") return { error: t.transferredLocked };
    const asked = [...new Set(input.relatedCompanyIds ?? [])];
    const allowed = asked.length ? new Set((await relatedTasks(main)).map((c) => c.id)) : new Set<number>();
    const extra = asked.filter((id) => allowed.has(id));
    if ((await Promise.all(extra.map((id) => canWorkCompany(u, id)))).some((c) => !c)) return { error: "Not found" };
    const outcomes = [await logCall(u, input, main)];
    // Sibling tasks are separate companies, so they can be saved at the same time.
    outcomes.push(...(await Promise.all(extra.map((id) => logCall(u, { ...input, companyId: id, phoneId: null })))));
    const failed = !input.contacted || input.attended === false;
    const result = failed ? (input.contacted ? "10" : input.noContactCode) : [...new Set(input.results.map((r) => r.code))].join(", ");
    // Written right after the answer is sent, so the agent doesn't wait for the activity log.
    after(() =>
      logActivity(u, "call.logged", {
        campaignId: main.campaignId, entity: "task", entityId: main.id,
        summary: `${main.key}${extra.length ? ` (+${extra.length} misma empresa)` : ""} · resultado: ${result}`,
      }).then(() => afterCallSaved(u, outcomes)),
    );
  } catch (e) {
    const msg = (e as Error).message;
    if (msg !== "commitmentRequired") await logError("action", `Registrar llamada: ${msg}`, { userId: u.id, path: "/calls", detail: (e as Error).stack ?? null });
    return { error: msg === "commitmentRequired" ? t.commitmentRequired : msg };
  }
  revalidatePath("/calls", "layout");
  return { ok: true, message: t.callSaved };
}

// What follows a saved call, after the agent already has the answer: the app's own decisions go to «Registro»,
// and the interaction, the changes the agent decided and a solved SIGTUR request are queued for SIGTUR.
async function afterCallSaved(u: { id: number; name: string }, outcomes: CallOutcome[]) {
  try {
    for (const o of outcomes) {
      if (o.toVisit) await logActivity(null, "task.to_visit", { campaignId: o.campaignId, entity: "task", entityId: o.companyId, summary: `${o.key} · ${o.answered ? "requiere visita" : "intentos fallidos o sin números válidos"}` });
      if (o.followupAt) await logActivity(null, "task.followup_scheduled", { campaignId: o.campaignId, entity: "task", entityId: o.companyId, summary: `${o.key} · ${o.followupAt}` });
      await queueCallInteractions(o.attemptId);
      await queueChanges(o.changes, u, "Llamada");
      if (o.answered || o.toVisit) await resolveRequest(o.companyId, { result: o.result, attemptId: o.attemptId });
    }
    await flushOutbox();
  } catch (e) {
    await logError("action", `Después de la llamada: ${(e as Error).message}`, { userId: u.id, path: "/calls", detail: (e as Error).stack ?? null });
  }
}

// Supervisors and administrators mark a call as reviewed, with an optional comment the agent will see.
export async function reviewCallAction(_: ActionState, form: FormData): Promise<ActionState> {
  const u = await assertUser(MANAGERS);
  const { t } = await getDict();
  const id = Number(form.get("attemptId"));
  const comment = String(form.get("comment") ?? "");
  try {
    const a = await reviewCall(u, id, comment);
    await logActivity(u, "call.reviewed", { campaignId: a.campaignId, entity: "call", entityId: a.id, summary: comment.trim() ? "Con comentario" : "Sin comentario" });
  } catch {
    return { error: "Not found" };
  }
  revalidatePath("/reviews", "layout");
  revalidatePath("/calls", "layout");
  return { ok: true, message: t.reviewSaved };
}

export async function addPhoneAction(_: ActionState, form: FormData): Promise<ActionState> {
  const u = await assertUser(["admin", "supervisor", "agent"]);
  const { t } = await getDict();
  const companyId = Number(form.get("companyId"));
  const company = await canWorkCompany(u, companyId);
  if (!company) return { error: "Not found" };
  const raw = String(form.get("number") ?? "").trim();
  const kind = String(form.get("kind"));
  const reason = String(form.get("reason"));
  const replaces = Number(form.get("replacesPhoneId")) || null;
  const normalized = normalizePhone(raw);
  if (normalized.length < 7) return { error: t.phoneNumber };
  if (!["substitute", "additional"].includes(kind) || !PHONE_KINDS[kind]) return { error: t.phoneKind };
  if (!PHONE_REASONS[reason]) return { error: t.phoneReason };
  if (kind === "substitute" && !replaces) return { error: t.phoneReplaces };
  const dup = await db.query.phones.findFirst({ where: and(eq(phones.companyId, companyId), eq(phones.normalized, normalized), eq(phones.active, true)) });
  if (dup) return { error: `${formatPhone(raw)} ✓` };
  if (kind === "substitute" && replaces) {
    await db.update(phones).set({ active: false }).where(and(eq(phones.id, replaces), eq(phones.companyId, companyId)));
  }
  await db.insert(phones).values({
    campaignId: company.campaignId,
    companyId,
    number: formatPhone(raw),
    normalized,
    source: "added",
    kind,
    reason,
    reasonNote: str(form.get("reasonNote")),
    replacesPhoneId: kind === "substitute" ? replaces : null,
    addedBy: u.id,
  });
  // A new number reopens a company that went to visit for lack of a working phone.
  const reopened = company.status === "visit" && company.failedAttempts > 0;
  if (reopened) {
    await db.update(companies).set({ status: "retry", failedAttempts: 0, nextActionAt: null }).where(eq(companies.id, companyId));
  }
  await logActivity(u, "phone.added", { campaignId: company.campaignId, entity: "task", entityId: companyId, summary: `${company.key}: ${formatPhone(raw)} (${kind}, ${reason})${reopened ? " · tarea reabierta para llamar" : ""}` });
  // Sent to SIGTUR as a change request (the agent decided it).
  const old = kind === "substitute" && replaces ? await db.query.phones.findFirst({ where: eq(phones.id, replaces) }) : null;
  const [firstEst] = await db.select({ id: establishments.id }).from(establishments).where(eq(establishments.companyId, companyId)).limit(1);
  if (firstEst) {
    after(async () => {
      await queueChanges([{ establishmentId: firstEst.id, field: "telefono", label: kind === "substitute" ? "Teléfono (sustituye)" : "Teléfono (adicional)", from: old?.number ?? null, to: `${formatPhone(raw)} · ${PHONE_REASONS[reason]?.es ?? reason}` }], u, "Llamada");
      await flushOutbox();
    });
  }
  revalidatePath(`/calls/${companyId}`);
  return { ok: true, message: t.saved };
}

// ---------- Visits ----------

export async function logVisitAction(_: ActionState, form: FormData): Promise<ActionState> {
  const u = await assertUser(["admin", "supervisor", "inspector"]);
  const { t } = await getDict();
  const code = String(form.get("code"));
  if (!VISIT_CODES[code]) return { error: t.visitResult };
  const visitDate = toIsoDate(String(form.get("visitDate"))) ?? todayLocal();
  const establishmentId = Number(form.get("establishmentId"));
  const field = (k: string) => String(form.get(k) ?? "").trim().slice(0, 200) || null;
  const v = await logVisit(u, {
    establishmentId,
    visitDate,
    code,
    commitmentDate: toIsoDate(String(form.get("commitmentDate") ?? "")),
    notes: str(form.get("notes")),
    newName: field("newName"),
    newAddress: field("newAddress"),
    newOwner: field("newOwner"),
  });
  await logActivity(u, "visit.logged", { campaignId: v.campaignId, entity: "establishment", entityId: establishmentId, summary: `${v.sigturId} · ${visitDate} · resultado: ${code}` });
  after(async () => {
    if (v.followupAt) await logActivity(null, "task.followup_scheduled", { campaignId: v.campaignId, entity: "task", entityId: v.companyId, summary: `${v.sigturId} · después de la visita · ${v.followupAt}` });
    await queueVisitInteraction(v.visitId);
    await queueChanges(v.changes, u, "Visita");
    await flushOutbox();
  });
  revalidatePath("/visits");
  return { ok: true, message: t.saved };
}

// ---------- Email tracking ----------

export async function markEmailsSentAction(_: ActionState, form: FormData): Promise<ActionState> {
  const u = await assertUser(MANAGERS);
  const { t } = await getDict();
  const campaignId = Number(form.get("campaignId"));
  const date = toIsoDate(String(form.get("date"))) ?? todayLocal();
  const status = String(form.get("estatus") ?? "");
  const where = [eq(establishments.campaignId, campaignId), eq(establishments.correoValido, "Sí")];
  if (status) where.push(eq(establishments.estatusRnt, status));
  if (form.get("onlyUnsent")) where.push(isNull(establishments.correoEnviadoFecha));
  const res = await db.update(establishments).set({ correoEnviadoFecha: date }).where(and(...where)).returning({ id: establishments.id });
  await logActivity(u, "emails.marked_sent", { campaignId, summary: `${res.length} establecimientos · fecha ${date}${status ? ` · ${status}` : ""}` });
  after(async () => {
    for (let i = 0; i < res.length; i += 500) await queueEmailInteractions(res.slice(i, i + 500).map((r) => r.id));
    await flushOutbox();
  });
  revalidatePath(`/campaigns/${campaignId}`, "layout");
  return { ok: true, message: `${res.length} ${t.updated}` };
}

export async function uploadBouncesAction(_: ActionState, form: FormData): Promise<ActionState> {
  const u = await assertUser(MANAGERS);
  const { t } = await getDict();
  const campaignId = Number(form.get("campaignId"));
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "No file" };
  const { rows, headers } = await readTable(file, ["Correo", "Email", "E-mail"]);
  const col = headers.find((h) => ["correo", "email", "e-mail"].includes(h.toLowerCase()));
  if (!col) return { error: "Columna «Correo» / “Correo” column missing" };
  const emails = [...new Set(rows.map((r) => str(r[col])?.toLowerCase()).filter(Boolean) as string[])];
  const ests = await db.select({ id: establishments.id, correo: establishments.correo }).from(establishments).where(eq(establishments.campaignId, campaignId));
  const set = new Set(emails);
  const ids = ests.filter((e) => e.correo && set.has(e.correo.trim().toLowerCase())).map((e) => e.id);
  for (let i = 0; i < ids.length; i += 500) await db.update(establishments).set({ correoRebotado: "Sí" }).where(inArray(establishments.id, ids.slice(i, i + 500)));
  await db.insert(importLogs).values({ campaignId, kind: "bounces", fileName: file.name, rows: rows.length, updated: ids.length, skipped: emails.length - ids.length, userId: u.id });
  await logActivity(u, "upload.bounces", { campaignId, entity: "file", summary: `${file.name}: ${ids.length} marcados como rebotados` });
  revalidatePath(`/campaigns/${campaignId}`, "layout");
  return { ok: true, message: `${ids.length} ${t.updated}` };
}

// ---------- SIGTUR status update ----------

export async function uploadStatusAction(_: ActionState, form: FormData): Promise<ActionState> {
  const u = await assertUser(MANAGERS);
  const { t } = await getDict();
  const target = String(form.get("target"));
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "No file" };
  const { rows, headers } = await readTable(file, ["ID SIGTUR", "Identificador", "RUT"]);
  const { normHeader } = await import("@/lib/sheets");
  const find = (...names: string[]) => headers.find((h) => names.map(normHeader).includes(normHeader(h)));
  const idCol = find("ID SIGTUR", "Identificador");
  const rutCol = find("RUT");
  const statusCol = find("Estatus SIGTUR actualizado", "Estatus SIGTUR", "Estatus RNT", "Estatus");
  const dateCol = find("Fecha cambio estatus", "Fecha");
  if ((!idCol && !rutCol) || !statusCol) return { error: "ID SIGTUR / RUT + Estatus SIGTUR actualizado" };
  const updates = rows
    .map((r) => ({
      sigturId: idCol ? str(r[idCol])?.replace(/\.0$/, "") ?? null : null,
      rut: rutCol ? str(r[rutCol]) : null,
      status: SIGTUR_STATUSES.find((s) => normHeader(s) === normHeader(String(r[statusCol] ?? ""))) ?? "",
      date: dateCol ? toIsoDate(r[dateCol]) : null,
    }))
    .filter((r) => r.status && (r.sigturId || r.rut));
  const ids =
    target === "all"
      ? (await db.select({ id: campaigns.id }).from(campaigns).where(ne(campaigns.status, "closed"))).map((c) => c.id)
      : [Number(target)];
  const r = await applyStatusUpdates(u, ids, updates);
  await db.insert(importLogs).values({ campaignId: target === "all" ? null : Number(target), kind: "status", fileName: file.name, rows: rows.length, updated: r.updated, skipped: r.notFound, userId: u.id });
  await logActivity(u, "upload.status", { campaignId: target === "all" ? null : Number(target), entity: "file", summary: `${file.name}: ${r.updated} estatus actualizados, ${r.notFound} no encontrados` });
  revalidatePath("/campaigns", "layout");
  return { ok: true, keep: true, message: `${r.updated} ${t.statusUpdated}, ${r.notFound} ${t.skipped}` };
}

// ---------- Follow-up: moving and covering tasks ----------

// Who receives: one person ("one") or shared evenly among the ticked people ("even").
function receivers(form: FormData) {
  const mode = String(form.get("mode"));
  const ids = mode === "one" ? [Number(form.get("toUserId"))] : form.getAll("people").map(Number);
  return { ids: ids.filter((n) => Number.isInteger(n) && n > 0), byWorkload: form.get("workload") === "on" };
}

async function activeAssignees(ids: number[]) {
  if (!ids.length) return [];
  const rows = await db.select({ id: users.id }).from(users).where(and(inArray(users.id, ids), eq(users.active, true), inArray(users.role, ["agent", "supervisor", "admin"])));
  return rows.map((r) => r.id);
}

export async function moveTasksAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertUser(MANAGERS);
  const { t } = await getDict();
  const campaignId = Number(form.get("campaignId"));
  const fromUserId = Number(form.get("fromUserId"));
  const r = receivers(form);
  const to = await activeAssignees(r.ids);
  if (!to.length) return { error: t.chooseReceivers };
  const n = await moveTasks(campaignId, fromUserId, to, r.byWorkload);
  const from = await db.query.users.findFirst({ where: eq(users.id, fromUserId) });
  await logActivity(me, "task.moved", { campaignId, entity: "user", entityId: fromUserId, summary: `${n} tareas abiertas de ${from?.name ?? fromUserId} → ${to.length === 1 ? "una persona" : `repartidas entre ${to.length}`}` });
  revalidatePath(`/campaigns/${campaignId}`, "layout");
  return { ok: true, message: `${n} ${t.assignedCount}` };
}

export async function coverTasksAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertUser(MANAGERS);
  const { t } = await getDict();
  const campaignId = Number(form.get("campaignId"));
  const absenceId = Number(form.get("absenceId"));
  const r = receivers(form);
  const to = await activeAssignees(r.ids);
  if (!to.length) return { error: t.chooseReceivers };
  const n = await coverTasks(campaignId, absenceId, to, r.byWorkload);
  await logActivity(me, "task.covered", { campaignId, entity: "absence", entityId: absenceId, summary: `${n} tareas cubiertas durante la ausencia` });
  revalidatePath(`/campaigns/${campaignId}`, "layout");
  revalidatePath("/calls", "layout");
  return { ok: true, message: `${n} ${t.coveredCount}` };
}

// ---------- Absences (administrators) ----------

export async function addAbsenceAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertUser(["admin"]);
  const { t } = await getDict();
  const parsed = z
    .object({
      userId: z.coerce.number().int().positive(),
      fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      kind: z.enum(ABSENCE_KINDS),
      note: z.string().trim().max(200).optional().default(""),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success || parsed.data.toDate < parsed.data.fromDate) return { error: t.absenceDatesError };
  const u = await db.query.users.findFirst({ where: eq(users.id, parsed.data.userId) });
  if (!u) return { error: "Not found" };
  const d = parsed.data;
  await db.insert(absences).values({ userId: d.userId, fromDate: d.fromDate, toDate: d.toDate, kind: d.kind, note: d.note || null, createdBy: me.id });
  await logActivity(me, "absence.added", { entity: "user", entityId: u.id, summary: `${u.name}: ${d.fromDate} – ${d.toDate} (${d.kind})` });
  revalidatePath("/", "layout");
  return { ok: true, message: t.saved };
}

export async function deleteAbsenceAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertUser(["admin"]);
  const { t } = await getDict();
  const id = Number(form.get("absenceId"));
  const a = await db.query.absences.findFirst({ where: eq(absences.id, id) });
  if (!a) return { error: "Not found" };
  await db.delete(absences).where(eq(absences.id, id));
  // Covered tasks go back to their owner right away.
  await syncCoverage(undefined, true);
  const u = await db.query.users.findFirst({ where: eq(users.id, a.userId) });
  await logActivity(me, "absence.deleted", { entity: "user", entityId: a.userId, summary: `${u?.name ?? a.userId}: ${a.fromDate} – ${a.toDate}` });
  revalidatePath("/", "layout");
  return { ok: true, message: t.saved };
}

// ---------- Call script ----------

export async function updateScriptAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertUser(MANAGERS);
  const { t } = await getDict();
  const id = Number(form.get("campaignId"));
  const c = await db.query.campaigns.findFirst({ where: eq(campaigns.id, id) });
  if (!c) return { error: "Not found" };
  const clean = (v: FormDataEntryValue | null) => String(v ?? "").trim().slice(0, 10000) || null;
  await db.update(campaigns).set({ scriptEs: clean(form.get("scriptEs")), scriptEn: clean(form.get("scriptEn")) }).where(eq(campaigns.id, id));
  await logActivity(me, "campaign.script_updated", { campaignId: id, entity: "campaign", entityId: id, summary: c.name });
  revalidatePath(`/campaigns/${id}`, "layout");
  revalidatePath("/calls", "layout");
  return { ok: true, message: t.saved };
}

// ---------- Report templates ("Estadísticas globales" → informe) ----------

export async function saveReportTemplateAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertUser(MANAGERS);
  const { t } = await getDict();
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  if (!name) return { error: t.reportNameRequired };
  let options;
  try {
    options = cleanOptions(JSON.parse(String(form.get("options") ?? "{}")));
  } catch {
    return { error: "Not found" };
  }
  const frequency = (FREQUENCIES as readonly string[]).includes(String(form.get("frequency"))) ? (String(form.get("frequency")) as Frequency) : "none";
  const runDay = Math.max(1, Math.min(frequency === "monthly" ? 28 : 7, Number(form.get("runDay")) || 1));
  const values = {
    name,
    options: JSON.stringify(options),
    frequency,
    runDay: frequency === "none" ? null : runDay,
    nextRunOn: firstRun(frequency, runDay, todayLocal()),
    paused: false,
  };
  const id = Number(form.get("templateId")) || 0;
  if (id) {
    const existing = await db.query.reportTemplates.findFirst({ where: eq(reportTemplates.id, id) });
    if (!existing) return { error: "Not found" };
    await db.update(reportTemplates).set(values).where(eq(reportTemplates.id, id));
  } else {
    await db.insert(reportTemplates).values({ ...values, createdBy: me.id });
  }
  await logActivity(me, "report.template_saved", { entity: "report", entityId: id || null, summary: `${name} · ${frequency}` });
  revalidatePath("/stats", "layout");
  revalidatePath("/reports");
  return { ok: true, message: t.reportTemplateSaved };
}

export async function deleteReportTemplateAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertUser(MANAGERS);
  const { t } = await getDict();
  const id = Number(form.get("templateId"));
  const tpl = await db.query.reportTemplates.findFirst({ where: eq(reportTemplates.id, id) });
  if (!tpl) return { error: "Not found" };
  await db.delete(reportTemplates).where(eq(reportTemplates.id, id));
  await logActivity(me, "report.template_deleted", { entity: "report", entityId: id, summary: tpl.name });
  revalidatePath("/reports");
  revalidatePath("/stats", "layout");
  return { ok: true, message: t.saved };
}

export async function pauseReportTemplateAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertUser(MANAGERS);
  const { t } = await getDict();
  const id = Number(form.get("templateId"));
  const tpl = await db.query.reportTemplates.findFirst({ where: eq(reportTemplates.id, id) });
  if (!tpl) return { error: "Not found" };
  const paused = !tpl.paused;
  // When resumed, the next run is recalculated from today (missed runs are not made up).
  await db
    .update(reportTemplates)
    .set({ paused, nextRunOn: paused ? tpl.nextRunOn : firstRun(tpl.frequency as Frequency, tpl.runDay ?? 1, todayLocal()) })
    .where(eq(reportTemplates.id, id));
  await logActivity(me, "report.template_paused", { entity: "report_template", entityId: id, summary: `${tpl.name}: ${paused ? "pausada" : "reanudada"}` });
  revalidatePath("/reports");
  return { ok: true, message: t.saved };
}

export async function generateReportNowAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertUser(MANAGERS);
  const { t } = await getDict();
  const id = Number(form.get("templateId"));
  try {
    await generateAndStore(id, "manual", me.id);
  } catch {
    return { error: "Not found" };
  }
  await logActivity(me, "report.generated", { entity: "report", entityId: id, summary: "Generado a pedido" });
  revalidatePath("/reports");
  return { ok: true, message: t.reportGenerated };
}

// Only administrators delete reports kept in «Informes».
export async function deleteGeneratedReportAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertUser(["admin"]);
  const { t } = await getDict();
  const id = Number(form.get("reportId"));
  const [r] = await db.select({ id: generatedReports.id, name: generatedReports.name, periodLabel: generatedReports.periodLabel }).from(generatedReports).where(eq(generatedReports.id, id));
  if (!r) return { error: "Not found" };
  await db.delete(generatedReports).where(eq(generatedReports.id, id));
  await logActivity(me, "report.deleted", { entity: "report", entityId: id, summary: `${r.name} · ${r.periodLabel ?? ""}` });
  revalidatePath("/reports");
  return { ok: true, message: t.saved };
}

// ---------- New campaign from another campaign's results ----------

function transferFilter(form: FormData): TransferFilter {
  const v = (k: string) => String(form.get(k) ?? "").trim() || undefined;
  return { statuses: form.getAll("statuses").map(String), code: v("code"), zone: v("zone"), priority: v("priority"), agent: v("agent") };
}

// Live count shown while choosing.
export async function countTransferAction(campaignId: number, f: TransferFilter): Promise<number> {
  await assertUser(MANAGERS);
  return countTransfer(Number(campaignId), { statuses: Array.isArray(f.statuses) ? f.statuses.map(String) : [], code: f.code || undefined, zone: f.zone || undefined, priority: f.priority || undefined, agent: f.agent || undefined });
}

export async function transferCampaignAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertUser(MANAGERS);
  const { t } = await getDict();
  const fromId = Number(form.get("campaignId"));
  const from = await db.query.campaigns.findFirst({ where: eq(campaigns.id, fromId) });
  if (!from) return { error: "Not found" };
  const parsed = campaignSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const r = await transferToNewCampaign(from, transferFilter(form), parsed.data, me.id);
  if (!r) return { error: t.transferNone };
  await logActivity(me, "campaign.from_results", { campaignId: r.campaign.id, entity: "campaign", entityId: r.campaign.id, summary: `${r.count} tareas de «${from.name}» → «${r.campaign.name}»` });
  revalidatePath("/campaigns", "layout");
  redirect(`/campaigns/${r.campaign.id}/companies`);
}

// ---------- Integraciones (SIGTUR) — administrators ----------

export async function createApiKeyAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertUser(["admin"]);
  const reauth = await reauthRequired();
  if (reauth) return reauth;
  const { t } = await getDict();
  const name = String(form.get("name") ?? "").trim().slice(0, 60) || "SIGTUR";
  const key = await createApiKey(name, me.id);
  await logActivity(me, "integration.key_created", { entity: "integration", summary: name });
  revalidatePath("/integrations");
  // Shown once on screen; only its fingerprint is stored.
  return { ok: true, keep: true, message: `${t.integrationKeyCreated} ${key}` };
}

export async function revokeApiKeyAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertUser(["admin"]);
  const { t } = await getDict();
  const id = Number(form.get("keyId"));
  const [k] = await db.select().from(apiKeys).where(eq(apiKeys.id, id));
  if (!k) return { error: "Not found" };
  await db.update(apiKeys).set({ revokedAt: nowIso() }).where(eq(apiKeys.id, id));
  await logActivity(me, "integration.key_revoked", { entity: "integration", entityId: id, summary: `${k.name} (${k.prefix}…)` });
  revalidatePath("/integrations");
  return { ok: true, message: t.saved };
}

// The permanent «Solicitudes SIGTUR» campaign: on = receives new requests, off = SIGTUR is told "en pausa".
export async function setSigturRequestsAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertUser(["admin"]);
  const { t } = await getDict();
  const on = form.get("on") === "1";
  await setRequestsPaused(!on, me.id);
  await logActivity(me, on ? "sigtur.requests_on" : "sigtur.requests_off", { entity: "campaign", summary: REQUESTS_CAMPAIGN });
  revalidatePath("/campaigns");
  revalidatePath("/integrations");
  return { ok: true, message: on ? t.sigturSwitchedOn : t.sigturSwitchedOff };
}

// «Envío automático a SIGTUR» (administrators). It only turns on once SIGTUR's address and key are set.
export async function setSigturPushAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertUser(["admin"]);
  const { t } = await getDict();
  const on = form.get("on") === "1";
  if (on && !(await pushSettings()).ready) return { error: t.pushNotReady };
  await setPushEnabled(on);
  await logActivity(me, on ? "sigtur.push_on" : "sigtur.push_off", { entity: "integration" });
  if (on) after(() => flushOutbox(true));
  revalidatePath("/integrations");
  return { ok: true, message: on ? t.pushSwitchedOn : t.pushSwitchedOff };
}

export async function saveSigturPushUrlAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertUser(["admin"]);
  const { t } = await getDict();
  const url = String(form.get("url") ?? "").trim();
  if (url && !validPushUrl(url)) return { error: t.pushUrlInvalid };
  await setPushUrl(url);
  if (!url) await setPushEnabled(false);
  await logActivity(me, "sigtur.push_url", { entity: "integration", summary: url || "(vacía)" });
  revalidatePath("/integrations");
  return { ok: true, message: t.saved };
}

export async function retrySigturPushAction(_: ActionState, form: FormData): Promise<ActionState> {
  void form;
  const me = await assertUser(["admin"]);
  const { t } = await getDict();
  const s = await pushSettings();
  if (!s.enabled || !s.ready) return { error: t.pushNotReady };
  const r = await retryFailed();
  await logActivity(me, "sigtur.retry", { entity: "integration", summary: `${r.sent} enviados · ${r.failed} con error` });
  revalidatePath("/integrations");
  return { ok: true, message: t.pushRetried.replace("{sent}", String(r.sent)).replace("{failed}", String(r.failed)) };
}

export async function saveAutoAssigneesAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertUser(["admin"]);
  const { t } = await getDict();
  const ids = form.getAll("people").map(Number).filter((n) => Number.isInteger(n) && n > 0);
  await setAutoAssignees(ids);
  const names = ids.length ? (await db.select({ name: users.name }).from(users).where(inArray(users.id, ids))).map((x) => x.name) : [];
  await logActivity(me, "sigtur.assignees_saved", { entity: "integration", summary: names.join(", ") || "Nadie" });
  revalidatePath("/integrations");
  return { ok: true, message: t.saved };
}

// Same path as a real SIGTUR request, to try it before SIGTUR connects.
export async function simulateCallRequestAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertUser(["admin"]);
  const { t } = await getDict();
  const r = parseCallRequest({
    idSigtur: form.get("idSigtur"), nombreComercial: form.get("nombreComercial"), telefonos: [String(form.get("telefono") ?? "")].filter(Boolean),
    motivo: form.get("motivo"), solicitadoPor: `${me.name} (${t.integrationSimulated})`,
  });
  if (typeof r === "string") return { error: r };
  if ((await requestsCampaign()).requestsPaused) return { error: t.sigturPausedSimulate };
  const res = await receiveCallRequest(r);
  await logIntegration(null, "call_request", true, `${r.idSigtur} · ${r.solicitadoPor}: ${r.motivo}`);
  await logActivity(me, "sigtur.call_request", { entity: "task", entityId: res.taskId, summary: `Simulación: ${r.idSigtur}` });
  revalidatePath("/", "layout");
  return { ok: true, message: res.existing ? t.integrationAddedToExisting : t.integrationRequestCreated };
}

// ---------- «Eliminar de la campaña» (administrators only) ----------

type RemovalSelection = { ids?: number[]; filters?: Record<string, string> };

// Counts shown before anything is deleted (from ticked tasks or "all filtered").
export async function previewRemovalAction(campaignId: number, sel: RemovalSelection): Promise<RemovalPreview | null> {
  await assertUser(["admin"]);
  const id = Number(campaignId);
  const ids = sel.filters ? await idsByFilters(id, cleanTaskFilters(sel.filters)) : Array.isArray(sel.ids) ? sel.ids.map(Number) : [];
  return previewRemoval(id, ids);
}

// Same, from a file with «RUT» or «ID SIGTUR» (screen «Actualizar estatus»).
export async function previewRemovalFileAction(_: ActionState, form: FormData): Promise<ActionState> {
  await assertUser(["admin"]);
  const { t } = await getDict();
  const campaignId = Number(form.get("campaignId"));
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: t.chooseFile };
  const { rows, headers } = await readTable(file, ["RUT", "ID SIGTUR", "Identificador"]);
  const { normHeader } = await import("@/lib/sheets");
  const cols = headers.filter((h) => ["rut", "idsigtur", "identificador"].includes(normHeader(h)));
  if (!cols.length) return { error: t.removeFileColumns };
  const keys = rows.flatMap((r) => cols.map((c) => str(r[c])?.replace(/\.0$/, "") ?? "")).filter(Boolean);
  const { ids, notFound } = await idsByKeys(campaignId, keys);
  return { ok: true, data: await previewRemoval(campaignId, ids, notFound) };
}

export async function removeTasksAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertUser(["admin"]);
  const reauth = await reauthRequired();
  if (reauth) return reauth;
  const { t } = await getDict();
  const campaignId = Number(form.get("campaignId"));
  const reason = String(form.get("reason") ?? "").trim().slice(0, 200);
  if (reason.length < 3) return { error: t.removeReasonRequired };
  if (String(form.get("confirm") ?? "").trim().toUpperCase() !== "ELIMINAR") return { error: t.removeConfirmWrong };
  let ids: number[] = [];
  try {
    const sel = JSON.parse(String(form.get("selection") ?? "{}")) as RemovalSelection;
    ids = sel.filters ? await idsByFilters(campaignId, cleanTaskFilters(sel.filters)) : Array.isArray(sel.ids) ? sel.ids.map(Number) : [];
  } catch {
    return { error: "Not found" };
  }
  const r = await removeTasks(me, campaignId, ids, reason);
  if (r.closed) return { error: t.removeClosed };
  if (r.tooMany) return { error: t.removeTooMany.replace("{n}", String(MAX_REMOVE)) };
  if (!r.removed) return { error: t.removeNone };
  await logActivity(me, "tasks.removed", { campaignId, entity: "campaign", entityId: campaignId, summary: `${r.removed} RUT eliminados de la campaña · motivo: ${reason}` });
  revalidatePath(`/campaigns/${campaignId}`, "layout");
  revalidatePath("/calls", "layout");
  return { ok: true, message: t.removeDone.replace("{n}", String(r.removed)) };
}
