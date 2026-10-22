import { logActivity } from "@/lib/audit";
import { keyFromRequest, logIntegration, parseCallRequest, receiveCallRequest } from "@/lib/sigtur";

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
  const res = await receiveCallRequest(r);
  const summary = `${r.idSigtur} · ${r.solicitadoPor}: ${r.motivo}`;
  await logIntegration(key.id, "call_request", true, `${summary}${res.existing ? " (tarea existente)" : ""}`);
  await logActivity(null, "sigtur.call_request", { entity: "task", entityId: res.taskId, summary });
  return Response.json({ ok: true, tarea: res.taskId, campana: res.campaign, asignada: res.assignedUserId != null, tareaExistente: res.existing });
}
