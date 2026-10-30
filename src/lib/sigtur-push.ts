import "server-only";
import { and, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { appMeta, companies, establishments, sigturOutbox } from "@/db/schema";
import { logActivity } from "./audit";
import { codeLabel } from "./catalog";
import { addHours, nowIso } from "./dates";
import { recordChanges } from "./changes";
import { buildInteractions, markOverdueRequests, type Interaction } from "./sigtur";

// «Envío automático a SIGTUR»: everything is queued from the moment it happens; it only leaves when an
// administrator switches sending on, SIGTUR's address is set and SIGTUR's key is in Vercel (SIGTUR_PUSH_KEY).

const ENABLED = "sigtur_push_enabled";
const URL_KEY = "sigtur_push_url";

export async function pushSettings() {
  const rows = await db.select().from(appMeta).where(inArray(appMeta.key, [ENABLED, URL_KEY]));
  const get = (k: string) => rows.find((r) => r.key === k)?.value ?? "";
  const url = get(URL_KEY);
  const hasKey = !!process.env.SIGTUR_PUSH_KEY;
  return { enabled: get(ENABLED) === "1", url, hasKey, ready: !!url && hasKey };
}

async function setMeta(key: string, value: string) {
  await db.insert(appMeta).values({ key, value }).onConflictDoUpdate({ target: appMeta.key, set: { value } });
}
export const setPushEnabled = (on: boolean) => setMeta(ENABLED, on ? "1" : "0");
export const setPushUrl = (url: string) => setMeta(URL_KEY, url);

export function validPushUrl(v: string) {
  try {
    const u = new URL(v);
    return u.protocol === "https:" && !!u.hostname;
  } catch {
    return false;
  }
}

// ---------- Queueing ----------

type Kind = "interaction" | "change" | "resolved";

async function enqueue(items: { kind: Kind; ref: string; sigturId: string | null; summary: string; payload: unknown }[]) {
  if (!items.length) return;
  await db
    .insert(sigturOutbox)
    .values(items.map((i) => ({ kind: i.kind, ref: i.ref, sigturId: i.sigturId, summary: i.summary.slice(0, 300), payload: JSON.stringify(i.payload) })))
    .onConflictDoNothing();
}

const interactionItems = (list: Interaction[]) =>
  list.map((i) => ({ kind: "interaction" as const, ref: i.id, sigturId: i.idSigtur, summary: `${i.canal} · ${i.resultado}`, payload: { tipo: "interaccion", id: i.id, datos: i } }));

export async function queueCallInteractions(attemptId: number) {
  await enqueue(interactionItems(await buildInteractions({ attemptId })));
}
export async function queueVisitInteraction(visitId: number) {
  await enqueue(interactionItems(await buildInteractions({ visitId })));
}
export async function queueEmailInteractions(establishmentIds: number[]) {
  if (establishmentIds.length) await enqueue(interactionItems(await buildInteractions({ emailEstIds: establishmentIds })));
}

// A change decided by a person (never by the app), sent to SIGTUR as a change request.
export type DataChange = { establishmentId: number; field: string; label: string; from: string | null; to: string | null };

export async function queueChanges(changes: DataChange[], by: { id: number; name: string }, source: string) {
  const real = changes.filter((c) => (c.to ?? "") !== (c.from ?? ""));
  if (!real.length) return;
  // Also kept for «Reporte de cambios» (SIGTUR updated by hand).
  await recordChanges(real, by, source);
  const ests = await db
    .select({ id: establishments.id, sigturId: establishments.sigturId, rut: establishments.rut, nombre: establishments.nombreComercial })
    .from(establishments)
    .where(inArray(establishments.id, [...new Set(real.map((c) => c.establishmentId))]));
  const byId = new Map(ests.map((e) => [e.id, e]));
  const at = nowIso();
  await enqueue(
    real.map((c, i) => {
      const e = byId.get(c.establishmentId);
      const ref = `cambio-${c.establishmentId}-${c.field}-${Date.parse(at)}-${i}`;
      return {
        kind: "change" as const,
        ref,
        sigturId: e?.sigturId ?? null,
        summary: `${c.label}: «${c.from ?? "—"}» → «${c.to ?? "—"}» (${by.name})`,
        payload: {
          tipo: "solicitudCambio",
          id: ref,
          datos: { idSigtur: e?.sigturId ?? null, rut: e?.rut ?? null, nombreComercial: e?.nombre ?? null, campo: c.field, campoTexto: c.label, valorAnterior: c.from, valorNuevo: c.to, solicitadoPor: by.name, origen: source, fechaHora: at },
        },
      };
    }),
  );
  await logActivity({ id: by.id, name: by.name }, "establishment.updated", {
    entity: "establishment",
    entityId: real[0].establishmentId,
    summary: real.map((c) => `${c.label}: «${c.from ?? "—"}» → «${c.to ?? "—"}»`).join(" · "),
  });
}

// A SIGTUR request counts as solved when someone answered (results 01–06) or the task went to visit.
export async function resolveRequest(companyId: number, how: { result: string; attemptId: number | null }) {
  const [c] = await db.select().from(companies).where(and(eq(companies.id, companyId), eq(companies.sigturRequest, true), isNull(companies.requestResolvedAt)));
  if (!c) return;
  const at = nowIso();
  await db.update(companies).set({ requestResolvedAt: at }).where(eq(companies.id, c.id));
  const [e] = await db.select({ sigturId: establishments.sigturId, rut: establishments.rut }).from(establishments).where(eq(establishments.companyId, c.id)).limit(1);
  const ref = `resuelta-${c.id}-${Date.parse(at)}`;
  const resultado = /^\d\d$/.test(how.result) ? codeLabel(how.result, "es") : how.result;
  await enqueue([
    {
      kind: "resolved",
      ref,
      sigturId: e?.sigturId ?? null,
      summary: `Pedida por ${c.requestedBy ?? "—"} · ${resultado}`,
      payload: {
        tipo: "solicitudResuelta",
        id: ref,
        datos: {
          idSolicitud: c.requestRef, idSigtur: e?.sigturId ?? null, rut: e?.rut ?? null, solicitadoPor: c.requestedBy, motivo: c.requestReason,
          recibidaEn: c.requestedAt, resueltaEn: at, resultado, interaccion: how.attemptId ? `llamada-${how.attemptId}` : null,
        },
      },
    },
  ]);
  await logActivity(null, "sigtur.request_resolved", { campaignId: c.campaignId, entity: "task", entityId: c.id, summary: `${c.key} · ${resultado}` });
}

// ---------- Sending ----------

let lastFlush = 0;

// Sends what is waiting (oldest first). Failures wait longer each time (2, 4, 8 … up to 60 minutes).
export async function flushOutbox(force = false, limit = 50) {
  if (!force && Date.now() - lastFlush < 60_000) return { sent: 0, failed: 0 };
  lastFlush = Date.now();
  const s = await pushSettings();
  if (!s.enabled || !s.ready) return { sent: 0, failed: 0 };
  const now = nowIso();
  const due = await db
    .select()
    .from(sigturOutbox)
    .where(and(inArray(sigturOutbox.status, ["pending", "error"]), or(isNull(sigturOutbox.nextTryAt), lte(sigturOutbox.nextTryAt, now))))
    .orderBy(sigturOutbox.id)
    .limit(limit);
  let sent = 0;
  let failed = 0;
  let lastError = "";
  for (const item of due) {
    let error: string | null = null;
    try {
      const res = await fetch(s.url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${process.env.SIGTUR_PUSH_KEY}` },
        body: item.payload,
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) error = `SIGTUR respondió ${res.status}`;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    if (!error) {
      sent++;
      await db.update(sigturOutbox).set({ status: "sent", sentAt: nowIso(), lastError: null, attempts: item.attempts + 1 }).where(eq(sigturOutbox.id, item.id));
    } else {
      failed++;
      lastError = error;
      const wait = Math.min(60, 2 ** Math.min(item.attempts + 1, 6));
      await db
        .update(sigturOutbox)
        .set({ status: "error", lastError: error.slice(0, 300), attempts: item.attempts + 1, nextTryAt: addHours(nowIso(), wait / 60) })
        .where(eq(sigturOutbox.id, item.id));
      // SIGTUR down: stop here and try the rest later, keeping the order.
      if (/fetch failed|timeout|ECONN|5\d\d/i.test(error)) break;
    }
  }
  if (sent) await logActivity(null, "sigtur.sent", { entity: "integration", summary: `${sent} envíos a SIGTUR` });
  if (failed) await logActivity(null, "sigtur.send_failed", { entity: "integration", summary: `${failed} con error: ${lastError}`.slice(0, 300) });
  return { sent, failed };
}

export async function retryFailed() {
  await db.update(sigturOutbox).set({ nextTryAt: null }).where(eq(sigturOutbox.status, "error"));
  return flushOutbox(true);
}

export async function outboxOverview(limit = 50) {
  const [counts, recent] = await Promise.all([
    db.select({ status: sigturOutbox.status, n: sql<number>`count(*)` }).from(sigturOutbox).groupBy(sigturOutbox.status),
    db.select().from(sigturOutbox).orderBy(desc(sigturOutbox.id)).limit(limit),
  ]);
  const n = (st: string) => Number(counts.find((c) => c.status === st)?.n ?? 0);
  return { pending: n("pending"), error: n("error"), sent: n("sent"), recent };
}

let lastBackground = 0;

// Runs while people use the app (at most every 5 minutes per server) and from the daily schedule.
export async function sigturBackground(force = false) {
  if (!force && Date.now() - lastBackground < 5 * 60_000) return;
  lastBackground = Date.now();
  await markOverdueRequests();
  await flushOutbox(force);
}
