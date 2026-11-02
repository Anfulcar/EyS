"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import type { ActionState } from "@/app/actions";
import type { PartyFromSigtur } from "@/lib/qr";
import type { QrDict } from "@/lib/qr-i18n";
import { toast } from "../Toasts";
import { ACCEPT, MAX_FILE, uploadFiles } from "./upload";

type Opt = { value: string; label: string };

// «+ Nuevo caso»: who it is about (RUT from SIGTUR or typed), who brings it, what happened and the proof.
export function NewCaseForm({ t, types, topics, channels, priorities, handlers, canAssign, cancelLabel, action, lookup }: {
  t: QrDict; types: Opt[]; topics: string[]; channels: Opt[]; priorities: Opt[]; handlers: Opt[]; canAssign: boolean; cancelLabel: string;
  action: (s: ActionState, f: FormData) => Promise<ActionState>; lookup: (key: string) => Promise<PartyFromSigtur | null>;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, null);
  const [sigtur, setSigtur] = useState(true);
  const [key, setKey] = useState("");
  const [found, setFound] = useState<PartyFromSigtur | null | undefined>(undefined);
  const [searching, startSearch] = useTransition();
  const [anon, setAnon] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState("");
  const [p, setP] = useState({ name: "", rnc: "", province: "", municipality: "", address: "", phone: "", email: "" });
  const [c, setC] = useState({ name: "", doc: "", nationality: "", phone: "", email: "" });
  const [w, setW] = useState({ type: types[0]?.value ?? "Queja", topic: "", channel: channels[0]?.value ?? "app", priority: "Media", subject: "", description: "", assignedUserId: "" });
  const [err, setErr] = useState("");

  const search = () => startSearch(async () => setFound(await lookup(key)));
  const party = sigtur ? (found ? { sigtur: true, ...found } : null) : p.name.trim() ? { sigtur: false, ...p } : null;
  const payload = JSON.stringify({ ...w, topic: w.topic || null, assignedUserId: w.assignedUserId || null, party, complainant: anon ? { anonymous: true } : { anonymous: false, ...c } });

  useEffect(() => {
    if (!state?.ok) return;
    const { number, token } = state.data as { number: string; token: string };
    (async () => {
      if (files.length) {
        const failed = await uploadFiles(files, { token }, (n) => setUploading(n));
        if (failed.length) toast(`${t.pfFilesFailed} ${failed.join(", ")}`);
      }
      router.push(`/quejas/${number}`);
    })();
  }, [state, files, router, t]);

  const pick = (list: FileList | null) => {
    const ok: File[] = [];
    for (const f of Array.from(list ?? [])) {
      if (f.size > MAX_FILE) setErr(t.tooBig.replace("{f}", f.name));
      else ok.push(f);
    }
    setFiles((x) => [...x, ...ok]);
  };
  const input = (label: string, value: string, set: (v: string) => void, id: string, type = "text") => (
    <div><label className="label" htmlFor={id}>{label}</label><input id={id} type={type} className="input" value={value} onChange={(e) => set(e.target.value)} /></div>
  );

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        setErr("");
        if (!party) { e.preventDefault(); setErr(t.errParty); return; }
        if (!w.subject.trim() || !w.description.trim()) { e.preventDefault(); setErr(t.errSubject); }
      }}
      className="space-y-6"
    >
      <input type="hidden" name="payload" value={payload} />
      <section className="space-y-3">
        <h3>{t.ncWho}</h3>
        <div className="segmented">
          {[[true, t.inSigtur], [false, t.notInSigtur]].map(([v, l]) => (
            <button key={String(v)} type="button" onClick={() => setSigtur(v as boolean)} aria-pressed={sigtur === v} className={`rounded-lg px-3.5 py-1.5 text-sm font-medium ${sigtur === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}>{l as string}</button>
          ))}
        </div>
        {sigtur ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <input aria-label={t.rutPh} placeholder={t.rutPh} className="input min-w-0 flex-1" value={key} onChange={(e) => setKey(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); search(); } }} />
              <button type="button" className="btn-secondary" onClick={search} disabled={searching || key.trim().length < 2}>{searching ? "…" : t.find}</button>
            </div>
            {found && (
              <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900" data-testid="rut-found">
                <b>{found.name}</b> · {[found.rut, found.sigturId].filter(Boolean).join(" · ")}
                <div className="text-xs">{[found.razon, found.rnc && `RNC ${found.rnc}`, found.rntStatus].filter(Boolean).join(" · ")}</div>
                <div className="text-xs">{[found.address, found.municipality, found.province].filter(Boolean).join(", ")}</div>
                <div className="mt-1 text-xs text-emerald-700">{t.found}</div>
              </div>
            )}
            {found === null && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{t.notFound}</p>}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {input(`${t.pName} *`, p.name, (v) => setP({ ...p, name: v }), "nc-pname")}
            {input(t.pDoc, p.rnc, (v) => setP({ ...p, rnc: v }), "nc-prnc")}
            {input(t.pProvince, p.province, (v) => setP({ ...p, province: v }), "nc-pprov")}
            {input(t.pMunicipality, p.municipality, (v) => setP({ ...p, municipality: v }), "nc-pmun")}
            {input(t.pAddress, p.address, (v) => setP({ ...p, address: v }), "nc-paddr")}
            {input(t.pPhone, p.phone, (v) => setP({ ...p, phone: v }), "nc-pphone")}
            {input(t.pEmail, p.email, (v) => setP({ ...p, email: v }), "nc-pemail", "email")}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3>{t.ncPresenter}</h3>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={anon} onChange={(e) => setAnon(e.target.checked)} /> {t.anonymous}</label>
        {!anon && (
          <div className="grid gap-3 sm:grid-cols-2">
            {input(t.cName, c.name, (v) => setC({ ...c, name: v }), "nc-cname")}
            {input(t.cDoc, c.doc, (v) => setC({ ...c, doc: v }), "nc-cdoc")}
            {input(t.cNationality, c.nationality, (v) => setC({ ...c, nationality: v }), "nc-cnat")}
            {input(t.pPhone, c.phone, (v) => setC({ ...c, phone: v }), "nc-cphone")}
            {input(t.pEmail, c.email, (v) => setC({ ...c, email: v }), "nc-cemail", "email")}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3>{t.ncWhat}</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><label className="label" htmlFor="nc-type">{t.type} *</label><select id="nc-type" className="input" value={w.type} onChange={(e) => setW({ ...w, type: e.target.value })}>{types.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
          <div><label className="label" htmlFor="nc-topic">{t.topic}</label><select id="nc-topic" className="input" value={w.topic} onChange={(e) => setW({ ...w, topic: e.target.value })}><option value="">—</option>{topics.map((o) => <option key={o}>{o}</option>)}</select></div>
          <div><label className="label" htmlFor="nc-channel">{t.channel}</label><select id="nc-channel" className="input" value={w.channel} onChange={(e) => setW({ ...w, channel: e.target.value })}>{channels.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
          <div><label className="label" htmlFor="nc-prio">{t.priority}</label><select id="nc-prio" className="input" value={w.priority} onChange={(e) => setW({ ...w, priority: e.target.value })}>{priorities.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
        </div>
        <div><label className="label" htmlFor="nc-subject">{t.subject} *</label><input id="nc-subject" className="input" maxLength={200} value={w.subject} onChange={(e) => setW({ ...w, subject: e.target.value })} /></div>
        <div><label className="label" htmlFor="nc-desc">{t.description} *</label><textarea id="nc-desc" className="input" rows={4} placeholder={t.descriptionPh} value={w.description} onChange={(e) => setW({ ...w, description: e.target.value })} /></div>
        <div>
          <span className="label">{t.proofs}</span>
          <label htmlFor="nc-files" className="block cursor-pointer rounded-xl border-2 border-dashed border-slate-200 px-4 py-4 text-center text-sm text-slate-500 transition hover:border-brand-300 hover:text-brand-700">{t.dropFiles} · {t.proofsHelp}</label>
          <input id="nc-files" type="file" multiple accept={ACCEPT} className="sr-only" onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
          {files.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {files.map((f, i) => (
                <li key={i} className="flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-3 pr-1 text-xs">
                  {f.name}
                  <button type="button" aria-label={`× ${f.name}`} className="rounded-full px-1.5 hover:bg-white" onClick={() => setFiles(files.filter((_, j) => j !== i))}>×</button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {canAssign && (
          <div><label className="label" htmlFor="nc-assign">{t.assignTo}</label><select id="nc-assign" className="input" value={w.assignedUserId} onChange={(e) => setW({ ...w, assignedUserId: e.target.value })}><option value="">{t.none}</option>{handlers.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
        )}
      </section>

      {(err || state?.error) && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{err || state?.error}</p>}
      {uploading && <p className="text-sm text-slate-600">{t.uploading.replace("{f}", uploading)}</p>}
      <div className="flex justify-end gap-2">
        {/* The window closes with Escape, like every pop-up of the app. */}
        <button type="button" className="btn-secondary" onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))}>{cancelLabel}</button>
        <button className="btn" disabled={pending || !!uploading}>{pending || uploading ? "…" : t.create}</button>
      </div>
    </form>
  );
}
