import type { Instrumentation } from "next";

// Records unexpected server errors in the error log (visible to administrators on "Registro").
// The import sits inside the Node.js-only branch so the edge build never includes the database code.
export const onRequestError: Instrumentation.onRequestError = async (error, request) => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { logError } = await import("@/lib/audit");
    const e = error as Error & { digest?: string };
    await logError("server", e.message ?? String(error), { path: request.path, digest: e.digest ?? null, detail: e.stack ?? null });
  }
};
