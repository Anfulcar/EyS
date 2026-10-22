import { buildInteractions, keyFromRequest, logIntegration } from "@/lib/sigtur";

export const dynamic = "force-dynamic";

// SIGTUR ← app: interactions (calls, visits, emails) to fill the Customer Service module.
// ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD&idSigtur=…&limite=500&desplazamiento=0
export async function GET(req: Request) {
  const key = await keyFromRequest(req);
  if (!key) return new Response("Not found", { status: 404 });
  const sp = new URL(req.url).searchParams;
  const date = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  const limit = Math.min(1000, Math.max(1, Number(sp.get("limite")) || 500));
  const offset = Math.max(0, Number(sp.get("desplazamiento")) || 0);
  const items = await buildInteractions({ from: date(sp.get("desde")), to: date(sp.get("hasta")), idSigtur: sp.get("idSigtur") || undefined, limit: limit + 1, offset });
  await logIntegration(key.id, "interactions", true, `${Math.min(items.length, limit)} interacciones leídas`);
  return Response.json({ interacciones: items.slice(0, limit), hayMas: items.length > limit, siguienteDesplazamiento: items.length > limit ? offset + limit : null });
}
