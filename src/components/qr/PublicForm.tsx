"use client";

import { useActionState, useEffect, useState } from "react";
import type { ActionState } from "@/app/actions";
import type { QrDict } from "@/lib/qr-i18n";
import { ACCEPT, MAX_FILE, uploadFiles } from "./upload";

type Opt = { value: string; label: string };

// What a tourist or citizen fills in, without an account. At the end they see their case number.
export function PublicForm({ t, types, topics, action }: { t: QrDict; types: Opt[]; topics: string[]; action: (s: ActionState, f: FormData) => Promise<ActionState> }) {
  const [state, formAction, pending] = useActionState(action, null);
  const [startedAt] = useState(() => Date.now());
  const [knows, setKnows] = useState(false);
  const [anon, setAnon] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState("");
  const [failed, setFailed] = useState<string[]>([]);
  const [done, setDone] = useState<{ number: string; days: number } | null>(null);
  const [f, setF] = useState({ type: types[0]?.value ?? "Queja", topic: "", rut: "", pname: "", province: "", municipality: "", address: "", name: "", email: "", phone: "", nationality: "", subject: "", description: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const payload = JSON.stringify({
    type: f.type, topic: f.topic || null, subject: f.subject, description: f.description,
    party: knows ? { sigtur: true, rut: f.rut, name: f.rut } : { sigtur: false, name: f.pname, province: f.province, municipality: f.municipality, address: f.address },
    complainant: anon ? { anonymous: true } : { anonymous: false, name: f.name, email: f.email, phone: f.phone, nationality: f.nationality },
  });

  useEffect(() => {
    if (!state?.ok) return;
    const d = state.data as { number: string; token: string; days: number };
    (async () => {
      if (files.length) setFailed(await uploadFiles(files, { token: d.token }, (n) => setBusy(n)));
      setBusy("");
      setDone({ number: d.number, days: d.days });
    })();
  }, [state, files]);

  if (done) {
    return (
      <div className="space-y-4">
        <div className="space-y-2 rounded-2xl border-2 border-dashed border-emerald-400 bg-emerald-50 p-5" data-testid="pf-ticket">
          <p>{t.pfThanks}</p>
          <p className="text-2xl font-bold tracking-wide text-emerald-700">{done.number}</p>
          <p className="text-sm text-slate-700">{t.pfThanksHelp.replace("{n}", String(done.days))}</p>
          {failed.length > 0 && <p className="text-sm text-amber-800">{t.pfFilesFailed} {failed.join(", ")}</p>}
        </div>
        <button type="button" className="btn-secondary" onClick={() => location.reload()}>{t.pfAnother}</button>
      </div>
    );
  }
  const field = (label: string, k: keyof typeof f, opts: { required?: boolean; type?: string; ph?: string } = {}) => (
    <div><label className="label" htmlFor={`pf-${k}`}>{label}{opts.required ? " *" : ""}</label><input id={`pf-${k}`} className="input" type={opts.type ?? "text"} value={f[k]} onChange={set(k)} required={opts.required} placeholder={opts.ph} maxLength={200} /></div>
  );
  return (
    <form action={formAction} className="card space-y-5">
      <input type="hidden" name="payload" value={payload} />
      <input type="hidden" name="startedAt" value={startedAt} />
      {/* Left empty by people; robots fill it. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor="pf-type">{t.pfWhat} *</label><select id="pf-type" className="input" value={f.type} onChange={set("type")}>{types.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
        <div><label className="label" htmlFor="pf-topic">{t.topic}</label><select id="pf-topic" className="input" value={f.topic} onChange={set("topic")}><option value="">—</option>{topics.map((x) => <option key={x}>{x}</option>)}</select></div>
      </div>
      <fieldset className="space-y-3">
        <legend className="mb-2 font-semibold text-slate-900">{t.pfPlace}</legend>
        <div className="flex flex-wrap gap-2">
          <label className="choice"><input type="radio" name="knows" checked={!knows} onChange={() => setKnows(false)} className="accent-brand-600" /> {t.pfDontKnow}</label>
          <label className="choice"><input type="radio" name="knows" checked={knows} onChange={() => setKnows(true)} className="accent-brand-600" /> {t.pfKnowRut}</label>
        </div>
        {knows ? field("RUT / ID SIGTUR", "rut", { required: true }) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {field(t.pName, "pname", { required: true })}
            {field(t.pProvince, "province")}
            {field(t.pMunicipality, "municipality")}
            {field(t.pAddress, "address")}
          </div>
        )}
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="mb-2 font-semibold text-slate-900">{t.pfYou}</legend>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} className="h-4 w-4 accent-brand-600" /> {t.pfAnon}</label>
        {!anon && (
          <div className="grid gap-3 sm:grid-cols-2">
            {field(t.cName, "name", { required: true })}
            {field(t.pEmail, "email", { type: "email" })}
            {field(t.pPhone, "phone")}
            {field(t.cNationality, "nationality")}
          </div>
        )}
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="mb-2 font-semibold text-slate-900">{t.pfHappened}</legend>
        {field(t.pfOneLine, "subject", { required: true })}
        <div><label className="label" htmlFor="pf-description">{t.pfDetails} *</label><textarea id="pf-description" className="input" rows={5} value={f.description} onChange={set("description")} required maxLength={5000} /></div>
        <div>
          <label className="label" htmlFor="pf-files">{t.proofs}</label>
          <input id="pf-files" type="file" multiple accept={ACCEPT} className="block w-full text-sm" onChange={(e) => { setFiles([...files, ...Array.from(e.target.files ?? []).filter((x) => x.size <= MAX_FILE)].slice(0, 5)); e.target.value = ""; }} />
          <p className="mt-1 text-xs text-slate-500">{t.proofsHelp}</p>
          {files.length > 0 && <p className="mt-1 text-xs text-slate-600">{files.map((x) => x.name).join(" · ")}</p>}
        </div>
      </fieldset>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="consent" value="1" required className="mt-0.5 h-4 w-4 accent-brand-600" /> {t.pfConsent}</label>
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{state.error}</p>}
      {busy && <p className="text-sm text-slate-600">{t.uploading.replace("{f}", busy)}</p>}
      <div className="flex justify-end"><button className="btn" disabled={pending || !!busy}>{pending || busy ? "…" : t.pfSend}</button></div>
    </form>
  );
}
