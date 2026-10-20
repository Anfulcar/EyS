import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

// Public health check: answers whether the app and its database are reachable (no data is returned).
export async function GET() {
  const started = Date.now();
  try {
    await db.run(sql`select 1`);
    return Response.json({ status: "ok", database: "ok", ms: Date.now() - started, time: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "error", database: "unreachable", time: new Date().toISOString() }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
