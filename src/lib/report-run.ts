import "server-only";
import { and, eq, gt, inArray, isNotNull, lt, lte, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { generatedReports, reportTemplates, users } from "@/db/schema";
import { logActivity, logError } from "./audit";
import type { Lang } from "./catalog";
import { todayLocal } from "./dates";
import { buildReport, type ReportAgent } from "./report-data";
import { cleanOptions, nextRun, type Frequency, type ReportOptions } from "./report-options";
import { renderPdf } from "./report-pdf";
import { renderPptx } from "./report-pptx";

export const MIME = { pdf: "application/pdf", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation" } as const;

// People who can be chosen in «Agentes» (active people who work tasks).
export async function reportPeople() {
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(eq(users.active, true), inArray(users.role, ["agent", "supervisor", "admin"])))
    .orderBy(users.name);
}

export const slugOf = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 80) || "Informe";

export type GeneratedFile = { name: string; content: Buffer; fileName: string; mime: string; periodLabel: string };

async function generateOne(o: ReportOptions, who: { name: string; scheduled?: boolean }, lang: Lang, agent?: ReportAgent): Promise<GeneratedFile> {
  const data = await buildReport(o, who, lang, todayLocal(), agent);
  const content = o.format === "pptx" ? await renderPptx(data, o.sections) : await renderPdf(data, o.sections);
  return { name: data.title, content, fileName: `${slugOf(data.title)}_${todayLocal()}.${o.format}`, mime: MIME[o.format], periodLabel: data.periodShort };
}

// The whole team in one report, or one report per chosen agent («Elegir agentes»).
export async function generateReports(o: ReportOptions, who: { name: string; scheduled?: boolean }, lang: Lang = "es"): Promise<GeneratedFile[]> {
  if (!o.agents.length) return [await generateOne(o, who, lang)];
  const people = await db.select({ id: users.id, name: users.name, role: users.role }).from(users).where(inArray(users.id, o.agents));
  const byId = new Map(people.map((p) => [p.id, p]));
  const out: GeneratedFile[] = [];
  for (const id of o.agents) {
    const agent = byId.get(id);
    if (agent) out.push(await generateOne(o, who, lang, agent));
  }
  return out;
}

// Generates a template's report and keeps it in "Informes generados".
export async function generateAndStore(templateId: number, source: "scheduled" | "manual", byUserId: number | null) {
  const tpl = await db.query.reportTemplates.findFirst({ where: eq(reportTemplates.id, templateId) });
  if (!tpl) throw new Error("Not found");
  const owner = byUserId ?? tpl.createdBy;
  const person = owner ? await db.query.users.findFirst({ where: eq(users.id, owner) }) : null;
  const o = cleanOptions(JSON.parse(tpl.options));
  const files = await generateReports(o, { name: person?.name ?? "—", scheduled: source === "scheduled" });
  // One entry per agent report, named after the template and the agent.
  const ids: number[] = [];
  for (const r of files) {
    const name = r.name === o.title ? tpl.name : `${tpl.name} – ${r.name.slice(o.title.length + 3)}`;
    const [row] = await db
      .insert(generatedReports)
      .values({ templateId: tpl.id, name, periodLabel: r.periodLabel, format: o.format, fileName: r.fileName, content: r.content, source, createdBy: byUserId })
      .returning({ id: generatedReports.id });
    ids.push(row.id);
  }
  return ids;
}

let lastCheck = 0;

// Runs every scheduled report that is due today or earlier. Called by the daily schedule (Vercel Cron)
// and, as a fallback, when managers open the reports screens (at most every 10 minutes).
export async function runDueReports(today = todayLocal(), force = false) {
  if (!force && Date.now() - lastCheck < 10 * 60_000) return 0;
  lastCheck = Date.now();
  const due = await db
    .select()
    .from(reportTemplates)
    .where(and(ne(reportTemplates.frequency, "none"), eq(reportTemplates.paused, false), isNotNull(reportTemplates.nextRunOn), lte(reportTemplates.nextRunOn, today)));
  let n = 0;
  for (const tpl of due) {
    const next = nextRun(tpl.frequency as Frequency, tpl.runDay ?? 1, tpl.nextRunOn!, today);
    // Claim the run first, so two servers never generate the same report twice.
    const claimed = await db
      .update(reportTemplates)
      .set({ nextRunOn: next })
      .where(and(eq(reportTemplates.id, tpl.id), eq(reportTemplates.nextRunOn, tpl.nextRunOn!)))
      .returning({ id: reportTemplates.id });
    if (!claimed.length) continue;
    try {
      await generateAndStore(tpl.id, "scheduled", null);
      await logActivity(null, "report.generated", { entity: "report", entityId: tpl.id, summary: `Informe programado: ${tpl.name}` });
      n++;
    } catch (e) {
      await logError("server", `Informe programado «${tpl.name}»: ${(e as Error).message}`, { detail: (e as Error).stack ?? null });
    }
  }
  // Reports are kept for 12 months.
  const cutoff = new Date(Date.now() - 365 * 86400000).toISOString();
  await db.delete(generatedReports).where(lt(generatedReports.createdAt, cutoff));
  return n;
}

// New reports since the person last opened «Informes» (their own downloads don't count as new).
export async function newReportsCount(user: { id: number; createdAt: string; reportsSeenAt: string | null }) {
  const since = user.reportsSeenAt ?? user.createdAt;
  const [r] = await db
    .select({ n: sql<number>`count(*)` })
    .from(generatedReports)
    .where(and(gt(generatedReports.createdAt, since), sql`coalesce(${generatedReports.createdBy}, 0) <> ${user.id}`));
  return Number(r?.n ?? 0);
}
