"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/app/actions";
import { toast } from "../Toasts";

// A list that saves as soon as another option is chosen (status, handler), as in the case file of the preview.
export function AutoSelect({ action, number, name, value, options, label, className = "" }: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>; number: string; name: string; value: string; options: { value: string; label: string }[]; label: string; className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && state.message) toast(state.message);
  }, [state]);
  return (
    <form ref={form} action={formAction} className={className}>
      <input type="hidden" name="number" value={number} />
      <select name={name} defaultValue={value} aria-label={label} disabled={pending} onChange={() => form.current?.requestSubmit()} className="input">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {state?.error && <p className="mt-1 text-xs text-mitur-red" role="alert">{state.error}</p>}
    </form>
  );
}
