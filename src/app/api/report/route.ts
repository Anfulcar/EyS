import { db } from "@/db";
import { generatedReports } from "@/db/schema";
import { logActivity } from "@/lib/audit";
import { MANAGERS, notFoundResponse, routeUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n-server";
import { optionsFromQuery } from "@/lib/report-options";
import { generateReport } from "@/lib/report-run";

// Report from "Estadísticas globales", generated now with the chosen options (PDF or PowerPoint).
export async function GET(req: Request) {
  const user = await routeUser(MANAGERS);
  if (!user) return notFoundResponse();
  const o = optionsFromQuery(new URL(req.url).searchParams);
  const { lang } = await getDict();
  const r = await generateReport(o, { name: user.name }, lang);
  // Every report generated is also kept in «Informes» (12 months), not only scheduled ones.
  await db.insert(generatedReports).values({ name: o.title, periodLabel: r.periodLabel, format: o.format, fileName: r.fileName, content: r.content, source: "manual", createdBy: user.id });
  await logActivity(user, "report.downloaded", { entity: "report", summary: `${o.title} (${o.format.toUpperCase()}) · ${r.periodLabel}`.slice(0, 500) });
  return new Response(new Uint8Array(r.content), {
    headers: { "Content-Type": r.mime, "Content-Disposition": `attachment; filename="${r.fileName}"`, "Cache-Control": "no-store" },
  });
}
