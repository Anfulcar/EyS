"use client";

import { useRef } from "react";

// Ticks or unticks every row checkbox linked to the bulk-assign form.
export function SelectAll({ form, label }: { form: string; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <input
      ref={ref}
      type="checkbox"
      data-select-all
      aria-label={label}
      title={label}
      className="h-4 w-4 accent-brand-600"
      onChange={(e) => {
        document.querySelectorAll<HTMLInputElement>(`input[type=checkbox][form="${form}"][name=ids]`).forEach((c) => (c.checked = e.target.checked));
      }}
    />
  );
}

// Agent dropdown in a row: saves as soon as another agent is chosen.
export function ReassignSelect({ action, companyId, value, options, unassignedLabel }: {
  action: (f: FormData) => Promise<void>; companyId: number; value: number | null; options: { id: number; name: string }[]; unassignedLabel: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={action}>
      <input type="hidden" name="companyId" value={companyId} />
      <select name="userId" defaultValue={value ?? ""} className="input w-40 py-1.5 text-xs" onChange={() => formRef.current?.requestSubmit()} aria-label="Asignado a">
        <option value="">{unassignedLabel}</option>
        {options.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
    </form>
  );
}
