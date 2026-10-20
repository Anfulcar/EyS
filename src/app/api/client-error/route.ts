import { logError } from "@/lib/audit";
import { routeUser } from "@/lib/auth";

// The browser reports pages that failed to load (only for signed-in people; the middleware blocks others).
export async function POST(req: Request) {
  const user = await routeUser();
  let body: { message?: unknown; digest?: unknown; path?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // ignore malformed reports
  }
  await logError("browser", String(body.message ?? "Unknown error").slice(0, 500), {
    userId: user?.id ?? null,
    path: typeof body.path === "string" ? body.path : null,
    digest: typeof body.digest === "string" ? body.digest : null,
  });
  return new Response(null, { status: 204 });
}
