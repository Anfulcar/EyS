import { eq } from "drizzle-orm";
import { db } from "@/db";
import { qrCases, qrReports } from "@/db/schema";
import { logActivity } from "@/lib/audit";
import { notFoundResponse, routeUser } from "@/lib/auth";
import { canSee, canSeePersonal } from "@/lib/qr";

// A version of a case report (PDF). It carries the presenter's personal data, so it needs «Ver datos personales».
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await routeUser("q.register");
  if (!u) return notFoundResponse();
  const [r] = await db.select().from(qrReports).where(eq(qrReports.id, Number((await params).id)));
  if (!r) return notFoundResponse();
  const [c] = await db.select().from(qrCases).where(eq(qrCases.id, r.caseId));
  if (!c || !canSee(u, c) || !canSeePersonal(u, c)) return notFoundResponse();
  await logActivity(u, "report.downloaded", { entity: "qr_case", entityId: c.id, summary: `${c.number} · informe v${r.version}` });
  return new Response(new Uint8Array(r.pdf as Buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="informe_${c.number}_v${r.version}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
