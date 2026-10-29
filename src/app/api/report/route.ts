import JSZip from "jszip";
import { db } from "@/db";
import { generatedReports } from "@/db/schema";
import { logActivity } from "@/lib/audit";
import { MANAGERS, notFoundResponse, routeUser } from "@/lib/auth";
import { todayLocal } from "@/lib/dates";
import { getDict } from "@/lib/i18n-server";
import { optionsFromQuery } from "@/lib/report-options";
import { generateReports, slugOf } from "@/lib/report-run";

export const maxDuration = 60;

// Report from «Generar informe», generated now with the chosen options (PDF or PowerPoint).
// With several agents: one report per agent, downloaded together in a .zip.
export async function GET(req: Request) {
  const user = await routeUser(MANAGERS);
  if (!user) return notFoundResponse();
  const o = optionsFromQuery(new URL(req.url).searchParams);
  const { lang } = await getDict();
  const files = await generateReports(o, { name: user.name }, lang);
  if (!files.length) return notFoundResponse();
  // Every report generated is also kept in «Informes» (12 months), not only scheduled ones.
  for (const r of files) {
    await db.insert(generatedReports).values({ name: r.name, periodLabel: r.periodLabel, format: o.format, fileName: r.fileName, content: r.content, source: "manual", createdBy: user.id });
  }
  await logActivity(user, "report.downloaded", {
    entity: "report",
    summary: `${files.map((f) => f.name).join(" · ")} (${o.format.toUpperCase()}) · ${files[0].periodLabel}`.slice(0, 500),
  });
  if (files.length === 1) {
    const [r] = files;
    return new Response(new Uint8Array(r.content), {
      headers: { "Content-Type": r.mime, "Content-Disposition": `attachment; filename="${r.fileName}"`, "Cache-Control": "no-store" },
    });
  }
  const zip = new JSZip();
  for (const r of files) zip.file(r.fileName, r.content);
  const body = await zip.generateAsync({ type: "uint8array" });
  return new Response(new Uint8Array(body), {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${slugOf(o.title)}_agentes_${todayLocal()}.zip"`, "Cache-Control": "no-store" },
  });
}
