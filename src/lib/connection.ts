// Client-side helpers so a lost connection or a server failure shows a clear message instead of failing silently.
import type { ActionState } from "@/app/actions";

export const CONNECTION_EVENT = "eys:connection-error";

export function connectionMessage() {
  const en = typeof document !== "undefined" && document.documentElement.lang === "en";
  return en
    ? "Can't reach the server. Check your connection and try again."
    : "No se pudo conectar con el servidor. Revise su conexión e intente de nuevo.";
}

// Redirects and "not found" travel as special errors inside Next.js; they must not be swallowed.
function isControlFlow(e: unknown) {
  const d = (e as { digest?: unknown } | null)?.digest;
  return typeof d === "string" && (d.startsWith("NEXT_REDIRECT") || d.startsWith("NEXT_NOT_FOUND") || d.startsWith("NEXT_HTTP_ERROR"));
}

export function reportConnectionProblem() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CONNECTION_EVENT));
}

export function withConnectionCheck(action: (s: ActionState, f: FormData) => Promise<ActionState>) {
  return async (s: ActionState, f: FormData): Promise<ActionState> => {
    try {
      return await action(s, f);
    } catch (e) {
      if (isControlFlow(e)) throw e;
      reportConnectionProblem();
      return { error: connectionMessage() };
    }
  };
}
