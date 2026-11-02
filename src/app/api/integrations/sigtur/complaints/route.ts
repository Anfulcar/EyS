import { logActivity } from "@/lib/audit";
import { cleanCaseInput, createCase, findSigturParty, qrSettings, QR_TYPES } from "@/lib/qr";
import { keyFromRequest, logIntegration } from "@/lib/sigtur";

export const dynamic = "force-dynamic";

type Body = {
  idSigtur?: string; rut?: string; tipo?: string; tema?: string; asunto?: string; descripcion?: string; referencia?: string; solicitadoPor?: string;
  presentadoPor?: { anonimo?: boolean; nombre?: string; documento?: string; nacionalidad?: string; telefono?: string; correo?: string };
};

// SIGTUR → app: a complaint, claim, report or suggestion about an establishment (see docs/sigtur-integracion.md).
// It arrives as a new case of «Quejas y reclamaciones», linked to the RUT.
export async function POST(req: Request) {
  const key = await keyFromRequest(req);
  if (!key) return new Response("Not found", { status: 404 });
  let b: Body;
  try {
    b = await req.json();
  } catch {
    await logIntegration(key.id, "complaint", false, "JSON inválido");
    return Response.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }
  const ref = String(b.rut ?? b.idSigtur ?? "").trim();
  const party = ref ? await findSigturParty(ref) : null;
  if (!party) {
    await logIntegration(key.id, "complaint", false, `RUT / ID SIGTUR no encontrado: ${ref || "—"}`);
    return Response.json({ ok: false, error: "rut o idSigtur no encontrado" }, { status: 400 });
  }
  const tipo = (QR_TYPES as readonly string[]).includes(String(b.tipo)) ? String(b.tipo) : "";
  if (!tipo) return Response.json({ ok: false, error: `tipo debe ser uno de: ${QR_TYPES.join(", ")}` }, { status: 400 });
  const p = b.presentadoPor ?? {};
  const s = await qrSettings();
  const clean = cleanCaseInput(
    {
      type: tipo, topic: b.tema ?? null, channel: "sigtur", priority: "Media", subject: String(b.asunto ?? ""), description: [b.descripcion, b.solicitadoPor ? `Enviado desde SIGTUR por ${b.solicitadoPor}.` : ""].filter(Boolean).join("\n\n"),
      party: { sigtur: true, ...party }, sourceRef: b.referencia ?? null,
      complainant: p.anonimo ? { anonymous: true } : { anonymous: false, name: p.nombre ?? b.solicitadoPor ?? null, doc: p.documento, nationality: p.nacionalidad, phone: p.telefono, email: p.correo },
    },
    s,
  );
  if (typeof clean === "string") {
    await logIntegration(key.id, "complaint", false, `Falta ${clean === "subject" ? "asunto o descripción" : clean}`);
    return Response.json({ ok: false, error: clean === "subject" ? "asunto y descripcion son obligatorios" : clean }, { status: 400 });
  }
  const c = await createCase(clean, null, s);
  await logIntegration(key.id, "complaint", true, `${c.number} · ${party.rut ?? party.sigturId}: ${c.subject}`);
  await logActivity(null, "qr.sigtur_case", { entity: "qr_case", entityId: c.id, summary: `${c.number} · ${party.rut ?? party.sigturId}` });
  return Response.json({ ok: true, caso: c.number, vence: c.due });
}
