"use client";

import { startTransition, useActionState, useCallback, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/app/actions";
import { withConnectionCheck } from "@/lib/connection";
import { ReauthPrompt } from "./ReauthPrompt";

type Props = {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  id?: string;
};

export function ActionForm({ action, children, className, resetOnSuccess, id }: Props) {
  // Keeps what was submitted, so it can be sent again after the password is confirmed
  // (the browser resets the form fields after each submission).
  const lastSubmitted = useRef<FormData | null>(null);
  const [state, formAction] = useActionState(
    withConnectionCheck((s: ActionState, f: FormData) => {
      lastSubmitted.current = f;
      return action(s, f);
    }),
    null,
  );
  const ref = useRef<HTMLFormElement>(null);
  const [askPassword, setAskPassword] = useState(false);
  useEffect(() => {
    setAskPassword(!!state?.needsReauth);
    if (!state?.ok) return;
    // The server action already sends back the refreshed screen (revalidatePath), so no second refresh is needed.
    if (resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  const continueAction = useCallback(() => {
    setAskPassword(false);
    const data = lastSubmitted.current;
    if (data) startTransition(() => formAction(data));
  }, [formAction]);
  return (
    <>
      <form ref={ref} id={id} action={formAction} className={className}>
        {children}
        {!askPassword && <Message state={state} />}
      </form>
      {askPassword && <ReauthPrompt onConfirmed={continueAction} />}
    </>
  );
}

export function Message({ state }: { state: ActionState }) {
  if (!state) return null;
  if (state.error) return <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>;
  if (state.message) return <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.message}</p>;
  return null;
}

export function SubmitButton({ children, className = "btn" }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending}>
      {pending ? "…" : children}
    </button>
  );
}

export function ConfirmButton({ children, message, className = "btn-danger" }: { children: React.ReactNode; message: string; className?: string }) {
  return (
    <button className={className} onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}>
      {children}
    </button>
  );
}
