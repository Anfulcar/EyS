import { eq } from "drizzle-orm";
import { db } from "@/db";
import { qrCases } from "@/db/schema";
import { ALLOWED_FILE, checkUploadToken, MAX_FILE, PART_SIZE, startFile } from "@/lib/qr";
import { uploaderFor } from "@/lib/qr-upload";

export const dynamic = "force-dynamic";

// Starts a proof file of a case (pieces follow in /part). Answers "not found" to anyone who may not add proof.
export async function POST(req: Request) {
  let b: { number?: string; token?: string; name?: string; mime?: string; size?: number };
  try {
    b = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const token = b.token ? String(b.token) : null;
  let caseId = token ? checkUploadToken(token) : null;
  if (!caseId && b.number) caseId = (await db.select({ id: qrCases.id }).from(qrCases).where(eq(qrCases.number, String(b.number))))[0]?.id ?? null;
  const who = caseId ? await uploaderFor(caseId, token) : null;
  if (!who) return new Response("Not found", { status: 404 });
  const size = Number(b.size), mime = String(b.mime ?? ""), name = String(b.name ?? "").trim();
  if (!name || !(size > 0) || size > MAX_FILE || !ALLOWED_FILE.test(mime)) return Response.json({ ok: false }, { status: 400 });
  const r = await startFile(who.c.id, { name, mime, size }, { id: who.user?.id ?? null, name: who.user?.name ?? "Formulario web" });
  return Response.json({ ok: true, fileId: r.fileId, parts: r.parts, partSize: PART_SIZE });
}
