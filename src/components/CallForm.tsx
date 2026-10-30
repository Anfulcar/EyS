"use client";

import {
  Ban, Building2, CalendarCheck, Check, DoorClosed, FileCheck2, LifeBuoy, MessageCircle, PhoneMissed, PhoneOff, RefreshCw, Save,
  UserRound, Voicemail, X, XCircle, type LucideIcon,
} from "lucide-react";
import { useActionState, useEffect, useMemo, useState } from "react";
import type { ActionState } from "@/app/actions";
import { CALL_CODES, NO_CONTACT_CODES, OBSTACLES, type Lang } from "@/lib/catalog";
import { withConnectionCheck } from "@/lib/connection";
import type { Dict } from "@/lib/i18n";
import { Message, SubmitButton } from "./ActionForm";

type Est = { id: number; name: string; status: string | null };
type PhoneOpt = { id: number; number: string; quality: string };
export type RelatedTask = { id: number; name: string; rut: string | null; status: string | null; rnt: string | null; warning: string | null; agentName: string | null; canWork: boolean; establishments: Est[]; phones: PhoneOpt[] };
type EstResult = { operating: "" | "Sí" | "No" | "No sabe"; code: string; commitmentDate: string; closedSince: string; obstacle: string; needsVisit: boolean; notes: string; newName: string; newAddress: string; newOwner: string };

const emptyResult: EstResult = { operating: "", code: "", commitmentDate: "", closedSince: "", obstacle: "", needsVisit: false, notes: "", newName: "", newAddress: "", newOwner: "" };

const CODE_ICONS: Record<string, LucideIcon> = {
  "01": CalendarCheck, "02": FileCheck2, "03": LifeBuoy, "04": Ban, "05": DoorClosed, "06": RefreshCw,
  "07": PhoneOff, "08": PhoneMissed, "09": XCircle, "10": Voicemail,
};

function YesNo({ name, value, onChange, t, withUnknown }: { name: string; value: string; onChange: (v: string) => void; t: Dict; withUnknown?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      <label className="choice choice-yes min-w-[6.5rem]">
        <input type="radio" className="sr-only" name={name} checked={value === "Sí"} onChange={() => onChange("Sí")} />
        <Check className="h-4 w-4" /> {t.yes}
      </label>
      <label className="choice choice-no min-w-[6.5rem]">
        <input type="radio" className="sr-only" name={name} checked={value === "No"} onChange={() => onChange("No")} />
        <X className="h-4 w-4" /> {t.no}
      </label>
      {withUnknown && (
        <label className="choice min-w-[6.5rem]">
          <input type="radio" className="sr-only" name={name} checked={value === "No sabe"} onChange={() => onChange("No sabe")} /> {t.unknown}
        </label>
      )}
    </div>
  );
}

function CodeTile({ code, lang, name, checked, onChange }: { code: string; lang: Lang; name: string; checked: boolean; onChange: () => void }) {
  const Icon = CODE_ICONS[code];
  return (
    <label className="choice">
      <input type="radio" className="sr-only" name={name} checked={checked} onChange={onChange} />
      <Icon className="h-4 w-4 shrink-0 opacity-70" /> {CALL_CODES[code][lang]}
    </label>
  );
}

function Section({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-t border-slate-100 pt-5 first:border-0 first:pt-0">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><Icon className="h-4 w-4" /></span>
        {title}
      </h3>
      {children}
    </section>
  );
}

export function CallForm({
  companyId, establishments, phones, related, t, lang, whatsappSuggested, action, currentEmail,
}: {
  companyId: number; establishments: Est[]; phones: PhoneOpt[]; related: RelatedTask[]; t: Dict; lang: Lang; whatsappSuggested: boolean;
  // The email on file (corrected one if any), shown filled in so the agent can fix it.
  currentEmail?: string | null;
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
}) {
  const [state, formAction] = useActionState(withConnectionCheck(action), null);
  const [together, setTogether] = useState<number[]>([]);
  const allPhones = useMemo(() => {
    const seen = new Set<string>();
    const out: (PhoneOpt & { owner?: string })[] = [];
    for (const p of phones) if (!seen.has(p.number)) { seen.add(p.number); out.push(p); }
    for (const r of related) if (together.includes(r.id)) for (const p of r.phones) if (!seen.has(p.number)) { seen.add(p.number); out.push({ ...p, owner: r.name }); }
    return out;
  }, [phones, related, together]);
  const allEsts = useMemo(() => [...establishments, ...related.filter((r) => together.includes(r.id)).flatMap((r) => r.establishments)], [establishments, related, together]);

  const [phoneId, setPhoneId] = useState<number | null>(phones.find((p) => p.quality === "ok")?.id ?? phones[0]?.id ?? null);
  const [contacted, setContacted] = useState("");
  const [noContactCode, setNoContactCode] = useState("");
  const [attended, setAttended] = useState("");
  const [spokeWith, setSpokeWith] = useState("");
  const [spokeRole, setSpokeRole] = useState("");
  const [isResponsible, setIsResponsible] = useState("");
  const [updatedEmail, setUpdatedEmail] = useState(currentEmail ?? "");
  const [emailReceived, setEmailReceived] = useState("");
  const [whatsappSent, setWhatsappSent] = useState(false);
  const [notes, setNotes] = useState("");
  const [results, setResults] = useState<Record<number, EstResult>>({});
  const res = (id: number) => results[id] ?? emptyResult;

  useEffect(() => {
    if (state?.ok) {
      setContacted(""); setNoContactCode(""); setAttended(""); setSpokeWith(""); setSpokeRole(""); setIsResponsible("");
      setUpdatedEmail(currentEmail ?? ""); setEmailReceived(""); setWhatsappSent(false); setNotes(""); setResults({}); setTogether([]);
    }
  }, [state, currentEmail]);

  const setR = (id: number, patch: Partial<EstResult>) => setResults((r) => ({ ...r, [id]: { ...(r[id] ?? emptyResult), ...patch } }));
  const applyToAll = () => {
    const first = res(allEsts[0].id);
    setResults(Object.fromEntries(allEsts.map((e) => [e.id, { ...first }])));
  };
  const talked = contacted === "Sí" && attended === "Sí";
  const phone = allPhones.find((p) => p.id === phoneId);

  const payload = JSON.stringify({
    companyId,
    phoneId,
    phoneNumber: phone?.number ?? null,
    relatedCompanyIds: together,
    contacted: contacted === "Sí",
    attended: contacted === "Sí" ? attended === "Sí" : null,
    noContactCode: contacted === "No" ? noContactCode : null,
    spokeWith: talked ? spokeWith || null : null,
    spokeRole: talked ? spokeRole || null : null,
    isResponsible: talked ? isResponsible === "Sí" : null,
    whatsappSent,
    // Only a different address counts as a correction.
    updatedEmail: talked && updatedEmail.trim() && updatedEmail.trim().toLowerCase() !== (currentEmail ?? "").trim().toLowerCase() ? updatedEmail.trim() : null,
    emailReceived: talked && emailReceived ? emailReceived : null,
    notes: notes || null,
    results: talked
      ? allEsts.map((e) => {
          const r = res(e.id);
          return {
            establishmentId: e.id,
            code: r.operating === "No" ? "05" : r.code,
            enOperacion: r.operating || null,
            commitmentDate: r.code === "01" && r.operating !== "No" ? r.commitmentDate || null : null,
            closedSince: r.operating === "No" ? r.closedSince || null : null,
            obstacle: r.obstacle || null,
            needsVisit: r.needsVisit,
            notes: r.notes || null,
            newName: r.code === "06" ? r.newName || null : null,
            newAddress: r.code === "06" ? r.newAddress || null : null,
            newOwner: r.code === "06" ? r.newOwner || null : null,
          };
        })
      : [],
  });

  const ready =
    contacted === "No" ? !!noContactCode :
    contacted === "Sí" && attended === "No" ? true :
    talked && allEsts.every((e) => res(e.id).operating === "No" || (res(e.id).operating && res(e.id).code && (res(e.id).code !== "01" || res(e.id).commitmentDate)));

  const workable = related.filter((r) => r.canWork);

  return (
    <form action={formAction} className="card space-y-5 p-0">
      <div className="space-y-5 p-5 sm:p-6">
        <h2>{t.registerCall}</h2>
        <input type="hidden" name="payload" value={payload} />

        {workable.length > 0 && (
          <Section icon={Building2} title={t.workTogether}>
            <p className="text-sm text-slate-500">{t.sameCompanyHelp}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {workable.map((r) => (
                <label key={r.id} className="choice">
                  <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={together.includes(r.id)} onChange={(e) => setTogether((x) => (e.target.checked ? [...x, r.id] : x.filter((i) => i !== r.id)))} />
                  <span className="min-w-0">
                    <span className="block truncate">{r.name}</span>
                    <span className="block truncate text-xs font-normal text-slate-500">{r.rut}{r.rnt ? ` · RNT: ${r.rnt}` : ""} · {r.status}</span>
                    {r.warning && <span className="block truncate text-xs font-normal text-rose-700" title={r.warning}>⚠ {r.warning}</span>}
                  </span>
                </label>
              ))}
            </div>
          </Section>
        )}

        <Section icon={PhoneMissed} title={t.callStepNumber}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">{t.phoneDialed}</label>
              <select className="input font-mono" value={phoneId ?? ""} onChange={(e) => setPhoneId(Number(e.target.value) || null)}>
                {allPhones.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.number}{p.quality !== "ok" ? ` (${t[`phoneQuality_${p.quality}` as keyof Dict]})` : ""}{p.owner ? ` · ${p.owner}` : ""}
                  </option>
                ))}
                <option value="">—</option>
              </select>
            </div>
            <p className="flex items-end pb-2.5 text-sm text-slate-500">{t.callTimeAuto}</p>
          </div>
        </Section>

        <Section icon={UserRound} title={t.callStepContact}>
          <div>
            <div className="label">{t.qContacted}</div>
            <YesNo name="contacted" value={contacted} onChange={setContacted} t={t} />
          </div>
          {contacted === "No" && (
            <div>
              <div className="label">{t.qNoContactReason}</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {NO_CONTACT_CODES.map((c) => <CodeTile key={c} code={c} lang={lang} name="nc" checked={noContactCode === c} onChange={() => setNoContactCode(c)} />)}
              </div>
            </div>
          )}
          {contacted === "Sí" && (
            <div>
              <div className="label">{t.qAttended}</div>
              <YesNo name="attended" value={attended} onChange={setAttended} t={t} />
              {attended === "No" && <p className="mt-2 text-xs text-slate-500">→ {CALL_CODES["10"][lang]}</p>}
            </div>
          )}
        </Section>

        {talked && (
          <Section icon={UserRound} title={t.callStepPerson}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="label">{t.qSpokeWith}</label><input className="input" value={spokeWith} onChange={(e) => setSpokeWith(e.target.value)} /></div>
              <div><label className="label">{t.qSpokeRole}</label><input className="input" value={spokeRole} onChange={(e) => setSpokeRole(e.target.value)} /></div>
              <div><div className="label">{t.qIsResponsible}</div><YesNo name="resp" value={isResponsible} onChange={setIsResponsible} t={t} /></div>
              <div><label className="label" htmlFor="call-email">{t.qUpdatedEmail}</label><input id="call-email" type="email" className="input" value={updatedEmail} onChange={(e) => setUpdatedEmail(e.target.value)} /></div>
              <div><div className="label">{t.qEmailReceived}</div><YesNo name="email-received" value={emailReceived} onChange={setEmailReceived} t={t} /></div>
            </div>
          </Section>
        )}

        {talked && (
          <Section icon={FileCheck2} title={t.callStepResults}>
            {allEsts.length > 1 && (
              <div className="flex justify-end"><button type="button" className="btn-secondary btn-sm" onClick={applyToAll}>{t.applyToAll}</button></div>
            )}
            {allEsts.map((e) => {
              const r = res(e.id);
              return (
                <div key={e.id} className="space-y-4 rounded-2xl bg-slate-50/80 p-4 ring-1 ring-slate-200/70">
                  <div className="font-semibold text-slate-900">{e.name} <span className="text-xs font-normal text-slate-500">· {e.status}</span></div>
                  <div>
                    <div className="label">{t.qOperating}</div>
                    <YesNo name={`op-${e.id}`} value={r.operating} onChange={(v) => setR(e.id, { operating: v as EstResult["operating"], code: v === "No" ? "05" : r.code === "05" ? "" : r.code })} t={t} withUnknown />
                  </div>
                  {r.operating === "No" && (
                    <div className="max-w-xs"><label className="label">{t.qClosedSince}</label><input className="input" value={r.closedSince} onChange={(ev) => setR(e.id, { closedSince: ev.target.value })} placeholder="2023" /></div>
                  )}
                  {r.operating && r.operating !== "No" && (
                    <>
                      <div>
                        <div className="label">{t.qResponse}</div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {["01", "02", "03", "04", "06"].map((c) => (
                            <CodeTile key={c} code={c} lang={lang} name={`code-${e.id}`} checked={r.code === c} onChange={() => setR(e.id, { code: c, needsVisit: c === "04" ? true : c === "03" ? r.needsVisit : false })} />
                          ))}
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
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
                          <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={r.needsVisit} onChange={(ev) => setR(e.id, { needsVisit: ev.target.checked })} /> {t.qNeedsVisit}</label>
                        )}
                      </div>
                      {r.code === "06" && (
                        <div className="space-y-2">
                          <div className="label">{t.updateDataTitle}</div>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div><label className="label" htmlFor={`newName-${e.id}`}>{t.updateName}</label><input id={`newName-${e.id}`} className="input" value={r.newName} onChange={(ev) => setR(e.id, { newName: ev.target.value })} maxLength={200} /></div>
                            <div><label className="label" htmlFor={`newAddress-${e.id}`}>{t.updateAddress}</label><input id={`newAddress-${e.id}`} className="input" value={r.newAddress} onChange={(ev) => setR(e.id, { newAddress: ev.target.value })} maxLength={200} /></div>
                            <div><label className="label" htmlFor={`newOwner-${e.id}`}>{t.updateOwner}</label><input id={`newOwner-${e.id}`} className="input" value={r.newOwner} onChange={(ev) => setR(e.id, { newOwner: ev.target.value })} maxLength={200} /></div>
                          </div>
                          <p className="text-xs text-slate-500">{t.updateDataHelp}</p>
                        </div>
                      )}
                    </>
                  )}
                  <div><label className="label">{t.notes}</label><input className="input" value={r.notes} onChange={(ev) => setR(e.id, { notes: ev.target.value })} /></div>
                </div>
              );
            })}
          </Section>
        )}

        {contacted && (
          <Section icon={MessageCircle} title={t.callStepNotes}>
            {(contacted === "No" || attended === "No") && (
              <div className="space-y-2">
                {whatsappSuggested && <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">{t.whatsappHint}</p>}
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={whatsappSent} onChange={(e) => setWhatsappSent(e.target.checked)} /> {t.qWhatsapp}</label>
              </div>
            )}
            <div><label className="label">{t.notes}</label><textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          </Section>
        )}
        <Message state={state} />
      </div>
      <div className="sticky bottom-0 flex items-center justify-end gap-3 rounded-b-2xl border-t border-slate-100 bg-white/95 px-5 py-3 backdrop-blur">
        {together.length > 0 && <span className="mr-auto text-xs text-slate-500">+ {together.length} {t.ofSameCompany}</span>}
        {ready ? <SubmitButton><Save className="h-4 w-4" />{t.save}</SubmitButton> : <button className="btn" disabled><Save className="h-4 w-4" />{t.save}</button>}
      </div>
    </form>
  );
}
