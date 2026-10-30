"use client";

import { useEffect, useState, useTransition } from "react";
import type { ActionState } from "@/app/actions";
import type { Dict } from "@/lib/i18n";
import { ActionForm, SubmitButton } from "./ActionForm";

type Opt = { value: string; label: string };
type Filter = { statuses: string[]; code?: string; zone?: string; priority?: string; agent?: string; mail?: string };

// «Nueva campaña de llamadas / de correo con estas tareas»: choose statuses and filters (with a live count), then the new campaign's data.
export function TransferForm({ campaignId, t, statuses, codes, zones, priorities, agents, fields, action, countAction, kind = "standard" }: {
  campaignId: number;
  t: Dict;
  statuses: (Opt & { n: number })[];
  codes: Opt[];
  zones: Opt[];
  priorities: Opt[];
  agents: Opt[];
  fields: React.ReactNode;
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  countAction: (campaignId: number, f: Filter) => Promise<number>;
  kind?: "standard" | "email";
}) {
  const email = kind === "email";
  // An email campaign usually starts from «¿Recibió el correo?: No», whatever the task's status.
  const [f, setF] = useState<Filter>(email ? { statuses: statuses.map((s) => s.value), mail: "no" } : { statuses: ["followup", "retry", "visit"] });
  const [count, setCount] = useState<number | null>(null);
  const [, start] = useTransition();
  useEffect(() => {
    start(async () => setCount(await countAction(campaignId, f)));
  }, [f, campaignId, countAction]);
  const set = (p: Partial<Filter>) => setF((x) => ({ ...x, ...p }));
  const select = (name: keyof Filter, label: string, opts: Opt[]) => (
    <div>
      <label className="label" htmlFor={`tr-${name}`}>{label}</label>
      <select id={`tr-${name}`} name={name} className="input" value={(f[name] as string) ?? ""} onChange={(e) => set({ [name]: e.target.value || undefined })}>
        <option value="">{t.all}</option>
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );

  return (
    <ActionForm action={action} className="space-y-5">
      <input type="hidden" name="campaignId" value={campaignId} />
      <input type="hidden" name="kind" value={kind} />
      <fieldset className="space-y-2">
        <legend className="label">{t.transferStatuses}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {statuses.map((s) => (
            <label key={s.value} className="choice">
              <input
                type="checkbox"
                name="statuses"
                value={s.value}
                checked={f.statuses.includes(s.value)}
                onChange={(e) => set({ statuses: e.target.checked ? [...f.statuses, s.value] : f.statuses.filter((x) => x !== s.value) })}
                className="h-4 w-4 accent-brand-600"
              />
              <span className="flex-1">{s.label}</span>
              <span className="text-xs text-slate-500">{s.n}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        {select("code", t.result, codes)}
        {select("zone", t.zone, zones)}
        {select("priority", t.priority, priorities)}
        {select("agent", t.assignedTo, agents)}
        {select("mail", t.qEmailReceived, [{ value: "no", label: t.no }, { value: "yes", label: t.yes }, { value: "none", label: t.mailNoAnswer }])}
      </div>
      <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm font-medium text-brand-900" aria-live="polite">
        {count == null ? "…" : (email ? t.emailCampaignCount : t.transferCount).replace("{n}", String(count))}
      </p>
      <div className="border-t border-slate-100 pt-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">{t.transferNewCampaign}</h3>
        {fields}
      </div>
      <p className="text-xs text-slate-500">{email ? t.emailCampaignHelp : t.transferHelp}</p>
      <div className="flex justify-end"><SubmitButton>{email ? t.emailCampaignCreate : t.transferCreate}</SubmitButton></div>
    </ActionForm>
  );
}
