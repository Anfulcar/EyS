import { logActivity } from "@/lib/audit";
import { keyFromRequest, logIntegration, parseSigturCampaign, receiveSigturCampaign } from "@/lib/sigtur";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// SIGTUR → app: a campaign created in SIGTUR's campaign module. It arrives as «Borrador».
export async function POST(req: Request) {
  const key = await keyFromRequest(req);
  if (!key) return new Response("Not found", { status: 404 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    await logIntegration(key.id, "campaign", false, "JSON inválido");
    return Response.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }
  const s = parseSigturCampaign(body);
  if (typeof s === "string") {
    await logIntegration(key.id, "campaign", false, s);
    return Response.json({ ok: false, error: s }, { status: 400 });
  }
  const r = await receiveSigturCampaign(s);
  if ("error" in r) {
    await logIntegration(key.id, "campaign", false, `${s.nombre}: ${r.error}`);
    return Response.json({ ok: false, error: r.error }, { status: 400 });
  }
  const summary = `«${s.nombre}» por ${s.creadoPor}: ${r.inserted} establecimientos, ${r.skipped} omitidos`;
  await logIntegration(key.id, "campaign", true, summary);
  await logActivity(null, "sigtur.campaign", { campaignId: r.campaign.id, entity: "campaign", entityId: r.campaign.id, summary });
  return Response.json({ ok: true, campana: r.campaign.id, estado: "Borrador", establecimientos: r.inserted, tareas: r.companies, omitidos: r.skipped, errores: r.errors });
}
