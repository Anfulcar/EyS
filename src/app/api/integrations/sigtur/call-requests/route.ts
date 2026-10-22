import { logActivity } from "@/lib/audit";
import { keyFromRequest, logIntegration, PAUSED_MESSAGE, parseCallRequest, receiveCallRequest, requestsCampaign } from "@/lib/sigtur";

export const dynamic = "force-dynamic";

// SIGTUR → app: an analyst requests a call from an establishment's profile (see docs/sigtur-integracion.md).
export async function POST(req: Request) {
  const key = await keyFromRequest(req);
  if (!key) return new Response("Not found", { status: 404 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    await logIntegration(key.id, "call_request", false, "JSON inválido");
    return Response.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }
  const r = parseCallRequest(body);
  if (typeof r === "string") {
    await logIntegration(key.id, "call_request", false, r);
    return Response.json({ ok: false, error: r }, { status: 400 });
  }
  // Switched off by an administrator: SIGTUR is told to try later and nothing is created.
  if ((await requestsCampaign()).requestsPaused) {
    await logIntegration(key.id, "call_request", false, `En pausa · ${r.idSigtur} · ${r.solicitadoPor}`);
    return Response.json({ ok: false, enPausa: true, error: PAUSED_MESSAGE }, { status: 503, headers: { "Retry-After": "3600" } });
  }
  const res = await receiveCallRequest(r);
  const summary = `${r.idSigtur} · ${r.solicitadoPor}: ${r.motivo}`;
  await logIntegration(key.id, "call_request", true, `${summary}${res.existing ? " (tarea existente)" : ""}`);
  await logActivity(null, "sigtur.call_request", { entity: "task", entityId: res.taskId, summary });
  return Response.json({ ok: true, tarea: res.taskId, campana: res.campaign, asignada: res.assignedUserId != null, tareaExistente: res.existing });
}
