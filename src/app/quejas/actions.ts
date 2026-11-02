"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { ActionState } from "@/app/actions";
import { db } from "@/db";
import { qrCases, qrFiles } from "@/db/schema";
import { logActivity } from "@/lib/audit";
import { toIsoDate } from "@/lib/dates";
import { getDict } from "@/lib/i18n-server";
import {
  addStep, answerReferral, approveClose, assign, atLeast, canSee, canWork, cleanCaseInput, createCase, findSigturParty, proposeClose, qrSettings, QR_MANUAL_CHANNELS,
  QR_TYPES, recentFromSender, refer, reopen, returnClose, saveQrSettings, senderFingerprint, setStatus, uploadToken, type CaseInput, type PartyFromSigtur, type QrSettings,
} from "@/lib/qr";
import { assertQr } from "@/lib/qr-auth";
import { QR_TEXT } from "@/lib/qr-i18n";
import { generateCaseReport } from "@/lib/qr-report";

const txt = async () => QR_TEXT[(await getDict()).lang];
const who = (u: { id: number; name: string }) => ({ id: u.id, name: u.name });
const str = (v: FormDataEntryValue | null, n = 3000) => String(v ?? "").trim().slice(0, n);

// The case named in the form, if this person may see it (and work it, when asked).
async function caseFrom(form: FormData, mustWork: boolean) {
  const u = await assertQr("register");
  const [c] = await db.select().from(qrCases).where(eq(qrCases.number, str(form.get("number"), 30)));
  if (!c || !canSee(u, c) || (mustWork && !canWork(u, c))) throw new Error("Not found");
  return { u, c };
}
const touch = (number: string) => {
  revalidatePath(`/quejas/${number}`);
  revalidatePath("/quejas");
};

export async function lookupRutAction(key: string): Promise<PartyFromSigtur | null> {
  await assertQr("register");
  return findSigturParty(String(key ?? "").slice(0, 40));
}

export async function createCaseAction(_: ActionState, form: FormData): Promise<ActionState> {
  const u = await assertQr("register");
  const t = await txt();
  let raw: CaseInput;
  try {
    raw = JSON.parse(str(form.get("payload"), 20000)) as CaseInput;
  } catch {
    return { error: t.errSubject };
  }
  // Only supervisors choose the handler; a handler's own case is assigned to them.
  raw.assignedUserId = atLeast(u, "supervise") ? Number(raw.assignedUserId) || null : atLeast(u, "manage") ? u.id : null;
  if (!(QR_MANUAL_CHANNELS as readonly string[]).includes(raw.channel)) raw.channel = "app";
  const s = await qrSettings();
  const clean = cleanCaseInput(raw, s);
  if (typeof clean === "string") return { error: clean === "party" ? t.errParty : t.errSubject };
  const c = await createCase(clean, who(u), s);
  await logActivity(u, "qr.case_created", { entity: "qr_case", entityId: c.id, summary: `${c.number} · ${c.type} · ${c.partyName}` });
  revalidatePath("/quejas");
  return { ok: true, message: t.created.replace("{n}", c.number), data: { number: c.number, token: uploadToken(c.id) } };
}

export async function addStepAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { u, c } = await caseFrom(form, true);
  const text = str(form.get("text"), 5000);
  if (!text) return { error: (await txt()).stepPh };
  await addStep(c.id, who(u), form.get("kind") === "internal" ? "internal" : "public", text);
  await logActivity(u, "qr.case_updated", { entity: "qr_case", entityId: c.id, summary: `${c.number} · paso agregado` });
  touch(c.number);
  return { ok: true, message: (await txt()).saved };
}

export async function setStatusAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { u, c } = await caseFrom(form, true);
  await setStatus(c, str(form.get("status"), 20), who(u));
  touch(c.number);
  return { ok: true, message: (await txt()).saved };
}

export async function assignAction(_: ActionState, form: FormData): Promise<ActionState> {
  const u = await assertQr("supervise");
  const { c } = await caseFrom(form, false);
  if (c.status === "cerrada") return { error: "Not found" };
  const ok = await assign(c, Number(form.get("userId")) || null, who(u));
  if (!ok) return { error: "Not found" };
  await logActivity(u, "qr.case_updated", { entity: "qr_case", entityId: c.id, summary: `${c.number} · responsable cambiado` });
  touch(c.number);
  return { ok: true, message: (await txt()).saved };
}

export async function referAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { u, c } = await caseFrom(form, true);
  const s = await qrSettings();
  const institution = str(form.get("institution"), 120);
  if (!institution || (!s.institutions.includes(institution) && institution.length < 3)) return { error: (await txt()).institution };
  await refer(c, { institution, dueOn: toIsoDate(str(form.get("dueOn"), 20)), note: str(form.get("note"), 2000) || null }, who(u));
  await logActivity(u, "qr.case_updated", { entity: "qr_case", entityId: c.id, summary: `${c.number} · referido a ${institution}` });
  touch(c.number);
  return { ok: true, message: (await txt()).saved };
}

export async function answerReferralAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { u, c } = await caseFrom(form, true);
  const response = str(form.get("response"), 3000);
  if (!response) return { error: (await txt()).responsePh };
  await answerReferral(c, Number(form.get("referralId")), response, who(u));
  touch(c.number);
  return { ok: true, message: (await txt()).saved };
}

export async function markFileReplacedAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { u, c } = await caseFrom(form, true);
  const id = Number(form.get("fileId"));
  const [f] = await db.select().from(qrFiles).where(and(eq(qrFiles.id, id), eq(qrFiles.caseId, c.id)));
  if (!f || f.replacedAt) return { error: "Not found" };
  await db.update(qrFiles).set({ replacedAt: new Date().toISOString() }).where(eq(qrFiles.id, id));
  await addStep(c.id, who(u), "internal", `Prueba marcada como reemplazada: ${f.name}.`);
  touch(c.number);
  return { ok: true, message: (await txt()).saved };
}

export async function proposeCloseAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { u, c } = await caseFrom(form, true);
  const t = await txt();
  const solution = str(form.get("solution"), 5000);
  if (!solution) return { error: t.solutionPh };
  await proposeClose(c, solution, str(form.get("note"), 500) || null, who(u));
  await logActivity(u, "qr.close_proposed", { entity: "qr_case", entityId: c.id, summary: c.number });
  touch(c.number);
  return { ok: true, message: t.saved };
}

export async function approveCloseAction(_: ActionState, form: FormData): Promise<ActionState> {
  const u = await assertQr("supervise");
  const { c } = await caseFrom(form, false);
  if (!(await approveClose(c, who(u)))) return { error: "Not found" };
  // The report is made when the case closes.
  await generateCaseReport(c.id, "auto", u.name);
  await logActivity(u, "qr.closed", { entity: "qr_case", entityId: c.id, summary: c.number });
  touch(c.number);
  return { ok: true, message: (await txt()).saved };
}

export async function returnCloseAction(_: ActionState, form: FormData): Promise<ActionState> {
  const u = await assertQr("supervise");
  const { c } = await caseFrom(form, false);
  const reason = str(form.get("reason"), 500);
  if (!reason) return { error: (await txt()).returnWhy };
  await returnClose(c, reason, who(u));
  await logActivity(u, "qr.close_returned", { entity: "qr_case", entityId: c.id, summary: `${c.number} · ${reason}` });
  touch(c.number);
  return { ok: true, message: (await txt()).saved };
}

export async function reopenAction(_: ActionState, form: FormData): Promise<ActionState> {
  const u = await assertQr("supervise");
  const { c } = await caseFrom(form, false);
  const reason = str(form.get("reason"), 500);
  if (!reason) return { error: (await txt()).reopenWhy };
  await reopen(c, reason, who(u));
  await logActivity(u, "qr.reopened", { entity: "qr_case", entityId: c.id, summary: `${c.number} · ${reason}` });
  touch(c.number);
  return { ok: true, message: (await txt()).saved };
}

export async function generateReportAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { u, c } = await caseFrom(form, false);
  if (!atLeast(u, "manage")) return { error: "Not found" };
  const r = await generateCaseReport(c.id, "request", u.name);
  await logActivity(u, "qr.report_generated", { entity: "qr_case", entityId: c.id, summary: `${c.number} · v${r?.version}` });
  touch(c.number);
  return { ok: true, message: (await txt()).saved };
}

// «Configuración del módulo» (supervisors): deadlines, the two lists and the public form, each saved on its own.
async function saveSettings(patch: (cur: QrSettings, form: FormData) => QrSettings, form: FormData, summary: (s: QrSettings) => string) {
  const u = await assertQr("supervise");
  const next = patch(await qrSettings(), form);
  await saveQrSettings(next);
  await logActivity(u, "qr.settings_changed", { entity: "settings", summary: summary(next).slice(0, 500) });
  revalidatePath("/quejas/configuracion");
  return { ok: true, message: (await txt()).saved };
}

export async function saveQrSlaAction(_: ActionState, form: FormData): Promise<ActionState> {
  const num = (f: FormData, k: string, dflt: number, max: number) => Math.min(max, Math.max(1, Number(f.get(k)) || dflt));
  return saveSettings(
    (cur, f) => ({
      ...cur,
      sla: Object.fromEntries(QR_TYPES.map((t) => [t, { first: num(f, `first-${t}`, cur.sla[t]?.first ?? 2, 60), resp: num(f, `resp-${t}`, cur.sla[t]?.resp ?? 15, 180) }])),
      warnDays: num(f, "warnDays", cur.warnDays, 20),
    }),
    form,
    (n) => `Plazos: ${QR_TYPES.map((t) => `${t} ${n.sla[t].first}/${n.sla[t].resp}`).join(" · ")}`,
  );
}

export async function saveQrListsAction(_: ActionState, form: FormData): Promise<ActionState> {
  const which = form.get("list") === "institutions" ? "institutions" : "topics";
  const items = [...new Set(str(form.get("items"), 8000).split("\n").map((x) => x.trim().slice(0, 100)).filter(Boolean))].slice(0, 60);
  return saveSettings(
    (cur) => {
      const list = items.length ? items : cur[which];
      if (which === "topics" && !list.includes("Otro")) list.push("Otro");
      return { ...cur, [which]: list };
    },
    form,
    (n) => `${which === "topics" ? "Temas" : "Instituciones"}: ${n[which].join(", ")}`,
  );
}

export async function saveQrPublicFormAction(_: ActionState, form: FormData): Promise<ActionState> {
  return saveSettings((cur, f) => ({ ...cur, publicForm: f.get("publicForm") === "1" }), form, (n) => `Formulario público: ${n.publicForm ? "encendido" : "apagado"}`);
}

// ---------- Public form (no account) ----------

export async function publicCaseAction(_: ActionState, form: FormData): Promise<ActionState> {
  const t = await txt();
  const s = await qrSettings();
  if (!s.publicForm) return { error: t.pfClosed };
  // Robots fill the hidden field or send in under 3 seconds.
  if (str(form.get("website"))) return { error: t.pfRequired };
  if (Date.now() - Number(form.get("startedAt") ?? 0) < 3000) return { error: t.pfRequired };
  if (form.get("consent") !== "1" || form.get("human") !== "1") return { error: t.pfRequired };
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "local";
  const sender = senderFingerprint(ip);
  if ((await recentFromSender(sender)) >= 5) return { error: t.pfTooMany };
  let raw: CaseInput;
  try {
    raw = JSON.parse(str(form.get("payload"), 20000)) as CaseInput;
  } catch {
    return { error: t.pfRequired };
  }
  if (!raw.complainant?.anonymous && (!raw.complainant?.name?.trim() || !(raw.complainant?.email?.trim() || raw.complainant?.phone?.trim()))) return { error: t.pfRequired };
  const party = raw.party?.sigtur && raw.party.rut ? await findSigturParty(raw.party.rut) : null;
  const clean = cleanCaseInput(
    { ...raw, channel: "web", priority: "Media", assignedUserId: null, senderHash: sender, sourceRef: null, party: party ? { sigtur: true, ...party } : { ...raw.party, sigtur: false } },
    s,
  );
  if (typeof clean === "string") return { error: t.pfRequired };
  const c = await createCase(clean, null, s);
  await logActivity(null, "qr.public_case", { entity: "qr_case", entityId: c.id, summary: `${c.number} · ${c.type} · formulario web` });
  return { ok: true, data: { number: c.number, token: uploadToken(c.id), days: s.sla[c.type]?.resp ?? 15 } };
}
