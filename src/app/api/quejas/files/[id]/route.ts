import { eq } from "drizzle-orm";
import { db } from "@/db";
import { qrCases } from "@/db/schema";
import { notFoundResponse } from "@/lib/auth";
import { canSee, fileContent } from "@/lib/qr";
import { routeQr } from "@/lib/qr-auth";

// A proof file, only for people who may see its case.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await routeQr("register");
  if (!u) return notFoundResponse();
  const r = await fileContent(Number((await params).id));
  if (!r) return notFoundResponse();
  const [c] = await db.select().from(qrCases).where(eq(qrCases.id, r.file.caseId));
  if (!c || !canSee(u, c)) return notFoundResponse();
  const inline = /^(image\/|application\/pdf|audio\/|video\/)/.test(r.file.mime);
  return new Response(new Uint8Array(r.data), {
    headers: {
      "Content-Type": r.file.mime,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(r.file.name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
