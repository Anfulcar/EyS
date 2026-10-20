"use client";

import { KeyRound } from "lucide-react";
import { useActionState, useEffect } from "react";
import { reauthAction } from "@/app/actions";
import { withConnectionCheck } from "@/lib/connection";
import { Message, SubmitButton } from "./ActionForm";

// Asks for the password again before a sensitive action, then lets the original form continue.
export function ReauthPrompt({ onConfirmed }: { onConfirmed: () => void }) {
  const [state, action] = useActionState(withConnectionCheck(reauthAction), null);
  useEffect(() => {
    if (state?.ok) onConfirmed();
  }, [state, onConfirmed]);
  const en = typeof document !== "undefined" && document.documentElement.lang === "en";
  return (
    <form action={action} className="mt-3 space-y-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
      <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
        <KeyRound className="h-4 w-4" /> {en ? "Confirm your password" : "Confirme su contraseña"}
      </div>
      <div className="flex flex-wrap gap-2">
        <input name="password" type="password" required autoFocus autoComplete="current-password" className="input max-w-xs" aria-label={en ? "Password" : "Contraseña"} />
        <SubmitButton>{en ? "Confirm and continue" : "Confirmar y continuar"}</SubmitButton>
      </div>
      <Message state={state?.ok ? null : state} />
    </form>
  );
}
