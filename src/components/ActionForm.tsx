"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/app/actions";
import { withConnectionCheck } from "@/lib/connection";

type Props = {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
};

export function ActionForm({ action, children, className, resetOnSuccess }: Props) {
  const [state, formAction] = useActionState(withConnectionCheck(action), null);
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (!state?.ok) return;
    if (resetOnSuccess) ref.current?.reset();
    router.refresh();
  }, [state, resetOnSuccess, router]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      <Message state={state} />
    </form>
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
