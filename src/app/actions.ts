"use server";

import bcrypt from "bcryptjs";
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { campaigns, companies, establishments, importLogs, phones, users } from "@/db/schema";
import { assertUser, clearSession, homeFor, MANAGERS, setSessionCookie } from "@/lib/auth";
import { CALL_CODES, PHONE_KINDS, PHONE_REASONS, PRIORITY_ORDER, ROLES, SIGTUR_STATUSES, VISIT_CODES } from "@/lib/catalog";
import { nowIso, toIsoDate, todayLocal } from "@/lib/dates";
import { DICTS } from "@/lib/i18n";
import { getDict } from "@/lib/i18n-server";
import { buildRecords, commitImport, previewImport } from "@/lib/importer";
import { formatPhone, normalizePhone, readTable, str } from "@/lib/sheets";
import { applyStatusUpdates, canWorkCompany, logCall, logVisit, relatedTasks, type CallInput } from "@/lib/workflow";

export type ActionState = { ok?: boolean; error?: string; message?: string; data?: unknown } | null;

// ---------- Session ----------

export async function loginAction(form: FormData) {
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const u = await db.query.users.findFirst({ where: eq(users.username, username) });
  if (!u || !u.active) redirect("/login?error=1");
  if (u.lockedUntil && u.lockedUntil > nowIso()) redirect("/login?error=locked");
  const ok = await bcrypt.compare(password, u.passwordHash);
  if (!ok) {
    const failed = u.failedLogins + 1;
    await db
      .update(users)
      .set({ failedLogins: failed >= 5 ? 0 : failed, lockedUntil: failed >= 5 ? new Date(Date.now() + 15 * 60000).toISOString() : null })
      .where(eq(users.id, u.id));
    redirect(failed >= 5 ? "/login?error=locked" : "/login?error=1");
  }
  await db.update(users).set({ failedLogins: 0, lockedUntil: null }).where(eq(users.id, u.id));
  await setSessionCookie(u);
  redirect(u.mustChangePassword ? "/account?force=1" : homeFor(u.role));
}

export async function logoutAction() {
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
  if (u.mustChangePassword) redirect(homeFor(u.role));
  return { ok: true, message: t.passwordChanged };
}

// ---------- Users ----------

const USERNAME_RE = /^[a-z0-9._-]{3,40}$/;

// Default temporary password: "<username>123". Users must change it at first login.
function defaultPassword(username: string) {
  return `${username}123`;
}

export async function createUserAction(_: ActionState, form: FormData): Promise<ActionState> {
  await assertUser(["admin"]);
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
  await db.insert(users).values({
    username: parsed.data.username,
    name: parsed.data.name,
    role: parsed.data.role,
    passwordHash: await bcrypt.hash(password, 10),
    mustChangePassword: true,
  });
  revalidatePath("/users");
  return { ok: true, message: `${t.saved}: ${parsed.data.username} / ${password}` };
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
  revalidatePath("/users");
  return { ok: true, message: newPassword ? `${t.saved}. ${t.password}: ${newPassword}` : t.saved };
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
  redirect(`/campaigns/${c.id}/import`);
}

export async function updateCampaignAction(_: ActionState, form: FormData): Promise<ActionState> {
  await assertUser(["admin"]);
  const { t } = await getDict();
  const id = Number(form.get("id"));
  const parsed = campaignSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  await db.update(campaigns).set(parsed.data).where(eq(campaigns.id, id));
  revalidatePath(`/campaigns/${id}`, "layout");
  return { ok: true, message: t.saved };
}

export async function setCampaignStatusAction(form: FormData) {
  await assertUser(["admin"]);
  const id = Number(form.get("id"));
  const status = String(form.get("status"));
  if (!["draft", "active", "closed"].includes(status)) return;
  await db.update(campaigns).set({ status }).where(eq(campaigns.id, id));
  revalidatePath(`/campaigns/${id}`, "layout");
  revalidatePath("/campaigns");
}

export async function deleteCampaignAction(form: FormData) {
  await assertUser(["admin"]);
  await db.delete(campaigns).where(eq(campaigns.id, Number(form.get("id"))));
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
  revalidatePath(`/campaigns/${campaignId}`, "layout");
  return { ok: true, message: `${t.importDone}: ${r.inserted} ${t.inserted}, ${r.updated} ${t.updated}, ${b.errors.length} ${t.skipped}. ${r.companies} ${t.companies.toLowerCase()}.` };
}

// ---------- Assignment ----------

export async function assignAction(_: ActionState, form: FormData): Promise<ActionState> {
  await assertUser(MANAGERS);
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
  else where.push(ne(companies.status, "done"));
  const list = await db.select().from(companies).where(and(...where));
  const sizes = await db.select({ companyId: establishments.companyId }).from(establishments).where(eq(establishments.campaignId, campaignId));
  const size = new Map<number, number>();
  for (const s of sizes) size.set(s.companyId, (size.get(s.companyId) ?? 0) + 1);

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
    const load = new Map(agentIds.map((a) => [a, 0]));
    const groups = new Map<string, typeof list>();
    for (const c of list) {
      const k = (c.rnc ?? "").replace(/[^0-9A-Za-z]/g, "") || `task:${c.id}`;
      groups.set(k, [...(groups.get(k) ?? []), c]);
    }
    const best = (g: typeof list) => Math.min(...g.map((c) => PRIORITY_ORDER[c.priority ?? ""] ?? 9));
    const sorted = [...groups.values()].sort((a, b) => best(a) - best(b) || b.length - a.length);
    for (const g of sorted) {
      const [agent] = [...load.entries()].sort((a, b) => a[1] - b[1])[0];
      for (const c of g) assignment.set(c.id, agent);
      load.set(agent, load.get(agent)! + g.reduce((n, c) => n + (size.get(c.id) ?? 1), 0));
    }
  }
  const byAgent = new Map<number, number[]>();
  for (const [cid, a] of assignment) byAgent.set(a, [...(byAgent.get(a) ?? []), cid]);
  for (const [a, ids] of byAgent) {
    for (let i = 0; i < ids.length; i += 500) {
      await db.update(companies).set({ assignedUserId: a }).where(inArray(companies.id, ids.slice(i, i + 500)));
    }
  }
  revalidatePath(`/campaigns/${campaignId}`, "layout");
  return { ok: true, message: `${assignment.size} ${t.assignedCount}` };
}

export async function reassignCompanyAction(form: FormData) {
  await assertUser(MANAGERS);
  const id = Number(form.get("companyId"));
  const userId = Number(form.get("userId")) || null;
  await db.update(companies).set({ assignedUserId: userId }).where(eq(companies.id, id));
  revalidatePath("/campaigns", "layout");
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
    input.calledAt = input.calledAt ? new Date(input.calledAt).toISOString() : nowIso();
    // The same call can be logged on sibling tasks (same RNC) that the user is allowed to work.
    const main = await canWorkCompany(u, input.companyId);
    if (!main) return { error: "Not found" };
    const allowed = new Set((await relatedTasks(main)).map((c) => c.id));
    const extra = [...new Set(input.relatedCompanyIds ?? [])].filter((id) => allowed.has(id));
    for (const id of extra) if (!(await canWorkCompany(u, id))) return { error: "Not found" };
    await logCall(u, input);
    for (const id of extra) await logCall(u, { ...input, companyId: id, phoneId: null });
  } catch (e) {
    const msg = (e as Error).message;
    return { error: msg === "commitmentRequired" ? t.commitmentRequired : msg };
  }
  revalidatePath("/calls", "layout");
  return { ok: true, message: t.callSaved };
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
  if (company.status === "visit" && company.failedAttempts > 0) {
    await db.update(companies).set({ status: "retry", failedAttempts: 0, nextActionAt: null }).where(eq(companies.id, companyId));
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
  await logVisit(u, {
    establishmentId: Number(form.get("establishmentId")),
    visitDate,
    code,
    commitmentDate: toIsoDate(String(form.get("commitmentDate") ?? "")),
    notes: str(form.get("notes")),
  });
  revalidatePath("/visits");
  return { ok: true, message: t.saved };
}

// ---------- Email tracking ----------

export async function markEmailsSentAction(_: ActionState, form: FormData): Promise<ActionState> {
  await assertUser(MANAGERS);
  const { t } = await getDict();
  const campaignId = Number(form.get("campaignId"));
  const date = toIsoDate(String(form.get("date"))) ?? todayLocal();
  const status = String(form.get("estatus") ?? "");
  const where = [eq(establishments.campaignId, campaignId), eq(establishments.correoValido, "Sí")];
  if (status) where.push(eq(establishments.estatusRnt, status));
  if (form.get("onlyUnsent")) where.push(isNull(establishments.correoEnviadoFecha));
  const res = await db.update(establishments).set({ correoEnviadoFecha: date }).where(and(...where)).returning({ id: establishments.id });
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
  revalidatePath("/campaigns", "layout");
  return { ok: true, message: `${r.updated} ${t.statusUpdated}, ${r.notFound} ${t.skipped}` };
}
