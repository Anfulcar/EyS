import { eq } from "drizzle-orm";
import { db } from "@/db";
import { generatedReports } from "@/db/schema";
import { logActivity } from "@/lib/audit";
import { MANAGERS, notFoundResponse, routeUser } from "@/lib/auth";
import { MIME } from "@/lib/report-run";

// Download of a report kept in "Informes generados".
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await routeUser(MANAGERS);
  if (!user) return notFoundResponse();
  const id = Number((await params).id);
  const r = Number.isInteger(id) ? await db.query.generatedReports.findFirst({ where: eq(generatedReports.id, id) }) : null;
  if (!r) return notFoundResponse();
  await logActivity(user, "report.downloaded", { entity: "report", entityId: r.id, summary: `${r.name} · ${r.periodLabel ?? ""}`.slice(0, 500) });
  return new Response(new Uint8Array(r.content), {
    headers: { "Content-Type": MIME[r.format as "pdf" | "pptx"] ?? "application/octet-stream", "Content-Disposition": `attachment; filename="${r.fileName}"`, "Cache-Control": "no-store" },
  });
}
