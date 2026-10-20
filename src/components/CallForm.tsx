"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import type { ActionState } from "@/app/actions";
import { CALL_CODES, NO_CONTACT_CODES, OBSTACLES, type Lang } from "@/lib/catalog";
import type { Dict } from "@/lib/i18n";
import { Message, SubmitButton } from "./ActionForm";

type Est = { id: number; name: string; status: string | null };
type PhoneOpt = { id: number; number: string; quality: string };
type EstResult = { operating: "" | "Sí" | "No" | "No sabe"; code: string; commitmentDate: string; closedSince: string; obstacle: string; needsVisit: boolean; notes: string };

const emptyResult: EstResult = { operating: "", code: "", commitmentDate: "", closedSince: "", obstacle: "", needsVisit: false, notes: "" };

function localNow() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function YesNo({ name, value, onChange, t, withUnknown }: { name: string; value: string; onChange: (v: string) => void; t: Dict; withUnknown?: boolean }) {
  const opts: [string, string][] = [["Sí", t.yes], ["No", t.no], ...(withUnknown ? ([["No sabe", t.unknown]] as [string, string][]) : [])];
  return (
    <div className="flex flex-wrap gap-2">
      {opts.map(([v, l]) => (
        <label key={v} className="choice">
          <input type="radio" className="sr-only" name={name} checked={value === v} onChange={() => onChange(v)} /> {l}
        </label>
      ))}
    </div>
  );
}

export function CallForm({
  companyId, establishments, phones, t, lang, whatsappSuggested, action,
}: {
  companyId: number; establishments: Est[]; phones: PhoneOpt[]; t: Dict; lang: Lang; whatsappSuggested: boolean;
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
}) {
  const [state, formAction] = useActionState(action, null);
  const [phoneId, setPhoneId] = useState<number | null>(phones.find((p) => p.quality === "ok")?.id ?? phones[0]?.id ?? null);
  const [calledAt, setCalledAt] = useState(localNow);
  const [contacted, setContacted] = useState("");
  const [noContactCode, setNoContactCode] = useState("");
  const [attended, setAttended] = useState("");
  const [spokeWith, setSpokeWith] = useState("");
  const [spokeRole, setSpokeRole] = useState("");
  const [isResponsible, setIsResponsible] = useState("");
  const [updatedEmail, setUpdatedEmail] = useState("");
  const [whatsappSent, setWhatsappSent] = useState(false);
  const [notes, setNotes] = useState("");
  const [results, setResults] = useState<Record<number, EstResult>>(() => Object.fromEntries(establishments.map((e) => [e.id, { ...emptyResult }])));

  useEffect(() => {
    if (state?.ok) {
      setContacted(""); setNoContactCode(""); setAttended(""); setSpokeWith(""); setSpokeRole(""); setIsResponsible("");
      setUpdatedEmail(""); setWhatsappSent(false); setNotes(""); setCalledAt(localNow());
      setResults(Object.fromEntries(establishments.map((e) => [e.id, { ...emptyResult }])));
    }
  }, [state, establishments]);

  const setR = (id: number, patch: Partial<EstResult>) => setResults((r) => ({ ...r, [id]: { ...r[id], ...patch } }));
  const applyToAll = () => {
    const first = results[establishments[0].id];
    setResults(Object.fromEntries(establishments.map((e) => [e.id, { ...first }])));
  };
  const talked = contacted === "Sí" && attended === "Sí";

  const payload = useMemo(
    () =>
      JSON.stringify({
        companyId,
        phoneId,
        calledAt: calledAt ? new Date(calledAt).toISOString() : "",
        contacted: contacted === "Sí",
        attended: contacted === "Sí" ? attended === "Sí" : null,
        noContactCode: contacted === "No" ? noContactCode : null,
        spokeWith: talked ? spokeWith || null : null,
        spokeRole: talked ? spokeRole || null : null,
        isResponsible: talked ? isResponsible === "Sí" : null,
        whatsappSent,
        updatedEmail: talked ? updatedEmail || null : null,
        notes: notes || null,
        results: talked
          ? establishments.map((e) => {
              const r = results[e.id];
              return {
                establishmentId: e.id,
                code: r.operating === "No" ? "05" : r.code,
                enOperacion: r.operating || null,
                commitmentDate: r.code === "01" && r.operating !== "No" ? r.commitmentDate || null : null,
                closedSince: r.operating === "No" ? r.closedSince || null : null,
                obstacle: r.obstacle || null,
                needsVisit: r.needsVisit,
                notes: r.notes || null,
              };
            })
          : [],
      }),
    [companyId, phoneId, calledAt, contacted, attended, noContactCode, spokeWith, spokeRole, isResponsible, whatsappSent, updatedEmail, notes, results, establishments, talked],
  );

  const ready =
    contacted === "No" ? !!noContactCode :
    contacted === "Sí" && attended === "No" ? true :
    talked && establishments.every((e) => results[e.id].operating === "No" || (results[e.id].operating && results[e.id].code && (results[e.id].code !== "01" || results[e.id].commitmentDate)));

  return (
    <form action={formAction} className="card space-y-5">
      <h2>{t.registerCall}</h2>
      <input type="hidden" name="payload" value={payload} />
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label">{t.phoneDialed}</label>
          <select className="input font-mono" value={phoneId ?? ""} onChange={(e) => setPhoneId(Number(e.target.value) || null)}>
            {phones.map((p) => <option key={p.id} value={p.id}>{p.number}{p.quality !== "ok" ? ` (${t[`phoneQuality_${p.quality}` as keyof Dict]})` : ""}</option>)}
            <option value="">—</option>
          </select>
        </div>
        <div>
          <label className="label">{t.calledAt}</label>
          <input type="datetime-local" className="input" value={calledAt} onChange={(e) => setCalledAt(e.target.value)} />
        </div>
      </div>

      <div>
        <div className="label">1. {t.qContacted}</div>
        <YesNo name="contacted" value={contacted} onChange={setContacted} t={t} />
      </div>

      {contacted === "No" && (
        <div>
          <div className="label">{t.qNoContactReason}</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {NO_CONTACT_CODES.map((c) => (
              <label key={c} className="choice"><input type="radio" className="sr-only" name="nc" checked={noContactCode === c} onChange={() => setNoContactCode(c)} /> {c} {CALL_CODES[c][lang]}</label>
            ))}
          </div>
        </div>
      )}

      {contacted === "Sí" && (
        <div>
          <div className="label">2. {t.qAttended}</div>
          <YesNo name="attended" value={attended} onChange={setAttended} t={t} />
          {attended === "No" && <p className="mt-2 text-xs text-slate-500">→ 10 {CALL_CODES["10"][lang]}</p>}
        </div>
      )}

      {talked && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <div><label className="label">3. {t.qSpokeWith}</label><input className="input" value={spokeWith} onChange={(e) => setSpokeWith(e.target.value)} /></div>
            <div><label className="label">{t.qSpokeRole}</label><input className="input" value={spokeRole} onChange={(e) => setSpokeRole(e.target.value)} /></div>
            <div><div className="label">{t.qIsResponsible}</div><YesNo name="resp" value={isResponsible} onChange={setIsResponsible} t={t} /></div>
          </div>
          <div className="max-w-md"><label className="label">{t.qUpdatedEmail}</label><input type="email" className="input" value={updatedEmail} onChange={(e) => setUpdatedEmail(e.target.value)} /></div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="label mb-0">4. {t.perEstablishment}</div>
              {establishments.length > 1 && <button type="button" className="btn-secondary btn-sm" onClick={applyToAll}>{t.applyToAll}</button>}
            </div>
            {establishments.map((e) => {
              const r = results[e.id];
              return (
                <div key={e.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="mb-3 font-medium">{e.name} <span className="text-xs font-normal text-slate-500">· {e.status}</span></div>
                  <div className="space-y-3">
                    <div><div className="label">{t.qOperating}</div><YesNo name={`op-${e.id}`} value={r.operating} onChange={(v) => setR(e.id, { operating: v as EstResult["operating"], code: v === "No" ? "05" : r.code === "05" ? "" : r.code })} t={t} withUnknown /></div>
                    {r.operating === "No" && (
                      <div className="max-w-xs"><label className="label">{t.qClosedSince}</label><input className="input" value={r.closedSince} onChange={(ev) => setR(e.id, { closedSince: ev.target.value })} placeholder="2023 / hace 2 años" /></div>
                    )}
                    {r.operating && r.operating !== "No" && (
                      <>
                        <div>
                          <div className="label">{t.qResponse}</div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {["01", "02", "03", "04", "06"].map((c) => (
                              <label key={c} className="choice"><input type="radio" className="sr-only" name={`code-${e.id}`} checked={r.code === c} onChange={() => setR(e.id, { code: c, needsVisit: c === "04" ? true : c === "03" ? r.needsVisit : false })} /> {c} {CALL_CODES[c][lang]}</label>
                            ))}
                          </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-3">
                          {r.code === "01" && (
                            <div><label className="label">{t.qCommitment} *</label><input type="date" className="input" required value={r.commitmentDate} onChange={(ev) => setR(e.id, { commitmentDate: ev.target.value })} /></div>
                          )}
                          <div>
                            <label className="label">{t.qObstacle}</label>
                            <select className="input" value={r.obstacle} onChange={(ev) => setR(e.id, { obstacle: ev.target.value })}>
                              <option value="">—</option>
                              {Object.entries(OBSTACLES).map(([k, v]) => <option key={k} value={k}>{v[lang]}</option>)}
                            </select>
                          </div>
                          {(r.code === "03" || r.code === "04") && (
                            <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={r.needsVisit} onChange={(ev) => setR(e.id, { needsVisit: ev.target.checked })} /> {t.qNeedsVisit}</label>
                          )}
                        </div>
                      </>
                    )}
                    <div><label className="label">{t.notes}</label><input className="input" value={r.notes} onChange={(ev) => setR(e.id, { notes: ev.target.value })} /></div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {(contacted === "No" || attended === "No") && (
        <div>
          {whatsappSuggested && <p className="mb-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{t.whatsappHint}</p>}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={whatsappSent} onChange={(e) => setWhatsappSent(e.target.checked)} /> {t.qWhatsapp}</label>
        </div>
      )}

      {contacted && (
        <div><label className="label">{t.notes}</label><textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      )}
      <div className="flex items-center gap-3">
        {ready ? <SubmitButton>{t.save}</SubmitButton> : <button className="btn" disabled>{t.save}</button>}
      </div>
      <Message state={state} />
    </form>
  );
}
