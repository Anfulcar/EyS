import { eq } from "drizzle-orm";
import { db } from "@/db";
import { qrFiles } from "@/db/schema";
import { logActivity } from "@/lib/audit";
import { PART_SIZE, putFilePart } from "@/lib/qr";
import { uploaderFor } from "@/lib/qr-upload";

export const dynamic = "force-dynamic";

// One piece of a proof file (at most 2 MB per request).
export async function POST(req: Request) {
  const url = new URL(req.url);
  const fileId = Number(url.searchParams.get("fileId"));
  const idx = Number(url.searchParams.get("idx"));
  const token = req.headers.get("x-upload-token");
  const [f] = await db.select({ caseId: qrFiles.caseId }).from(qrFiles).where(eq(qrFiles.id, fileId));
  const who = f ? await uploaderFor(f.caseId, token) : null;
  if (!who) return new Response("Not found", { status: 404 });
  const data = Buffer.from(await req.arrayBuffer());
  if (!data.length || data.length > PART_SIZE) return Response.json({ ok: false }, { status: 400 });
  const r = await putFilePart(fileId, idx, data);
  if (!r) return Response.json({ ok: false }, { status: 400 });
  if (r.complete) await logActivity(who.user, "qr.file_added", { entity: "qr_case", entityId: f!.caseId, summary: `${who.c.number} · ${r.file.name}` });
  return Response.json({ ok: true, complete: r.complete });
}
