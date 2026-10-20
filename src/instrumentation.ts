import type { Instrumentation } from "next";

// Records unexpected server errors in the error log (visible to administrators on "Registro").
export const onRequestError: Instrumentation.onRequestError = async (error, request) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { logError } = await import("@/lib/audit");
  const e = error as Error & { digest?: string };
  await logError("server", e.message ?? String(error), { path: request.path, digest: e.digest ?? null, detail: e.stack ?? null });
};
