import { runDueReports } from "@/lib/report-run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Daily schedule (Vercel Cron, see vercel.json): generates the reports that are due.
// Only answers when Vercel sends the CRON_SECRET set in the project's environment variables.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Not found", { status: 404 });
  const n = await runDueReports(undefined, true);
  return Response.json({ ok: true, generated: n });
}
