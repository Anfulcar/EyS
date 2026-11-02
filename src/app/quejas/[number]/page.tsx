import { FileText, Paperclip } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { FileUploader } from "@/components/qr/FileUploader";
import { db } from "@/db";
import { users } from "@/db/schema";
import { fmtDate, fmtDateTime, todayLocal } from "@/lib/dates";
import { getDict } from "@/lib/i18n-server";
import { atLeast, businessDaysBetween, caseDetail, caseFor, canWork, deadlineOf, handlers, otherCasesOfRut, qrSettings } from "@/lib/qr";
import { requireQr } from "@/lib/qr-auth";
import { QR_CHANNEL_TEXT, QR_STATUS_TEXT, QR_STATUS_TONE, QR_TEXT, QR_TYPE_TEXT } from "@/lib/qr-i18n";
import {
  addStepAction, answerReferralAction, approveCloseAction, assignAction, generateReportAction, markFileReplacedAction, proposeCloseAction, referAction, reopenAction, returnCloseAction, setStatusAction,
} from "../actions";

const FLOW = ["recibida", "analisis", "referida", "porcerrar", "cerrada"];
const TABS = ["resumen", "pasos", "referencias", "pruebas", "solucion", "informes"] as const;

export default async function CasePage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ tab?: string }> }) {
  const u = await requireQr("register");
  const number = decodeURIComponent((await params).number);
  const c = await caseFor(u, number);
  if (!c) notFound();
  const tab = (TABS as readonly string[]).includes((await searchParams).tab ?? "") ? (await searchParams).tab! : "resumen";
  const { lang } = await getDict();
  const t = QR_TEXT[lang];
  const [d, s, people, all, others] = await Promise.all([caseDetail(c.id), qrSettings(), handlers(), db.select({ id: users.id, name: users.name }).from(users), c.partyRut ? otherCasesOfRut(c.partyRut, c.id) : 0]);
  const nameOf = (id: number | null) => all.find((p) => p.id === id)?.name ?? "—";
  const work = canWork(u, c);
  const sup = atLeast(u, "supervise");
  const manager = atLeast(u, "manage");
  const dl = deadlineOf(c, s.warnDays);
  const firstLeft = businessDaysBetween(todayLocal(), c.firstDue);
  const cur = c.status === "espera" ? "analisis" : c.status;
  const ci = FLOW.indexOf(cur);
  const hidden = <input type="hidden" name="number" value={c.number} />;
  const counts: Record<string, number | undefined> = { pasos: d.steps.length, referencias: d.refs.length, pruebas: d.files.length, informes: d.reports.length };
  const tabLabel: Record<string, string> = { resumen: t.tSummary, pasos: t.tSteps, referencias: t.tRefs, pruebas: t.tFiles, solucion: t.tSolution, informes: t.tReports };
  const kv = (rows: [string, string | null | undefined][]) => (
    <dl className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
      {rows.filter(([, v]) => v).map(([k, v]) => <div key={k} className="contents"><dt className="text-slate-500">{k}</dt><dd className="break-words text-slate-900">{v}</dd></div>)}
    </dl>
  );

  return (
    <div className="space-y-5">
      <Link href="/quejas" className="text-sm font-medium text-slate-500 hover:text-slate-800">← {t.back}</Link>
      <div className="page-title">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="tabular-nums">{c.number}</h1>
            <span className={`badge ${QR_STATUS_TONE[c.status]}`}>{QR_STATUS_TEXT[lang][c.status]}</span>
            <span className="badge bg-slate-100 text-slate-700">{QR_CHANNEL_TEXT[lang][c.channel]}</span>
            {c.priority === "Alta" && <span className="badge bg-red-50 text-mitur-red">{t.highPriority}</span>}
          </div>
          <p className="mt-1 font-semibold text-slate-900">{c.subject}</p>
          <p className="subtitle">{QR_TYPE_TEXT[lang][c.type]}{c.topic ? ` · ${c.topic}` : ""} · {t.received} {fmtDateTime(c.createdAt, lang)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {work && !["porcerrar", "cerrada"].includes(c.status) && (
            <ActionForm action={setStatusAction} className="flex gap-2">
              {hidden}
              <select name="status" defaultValue={c.status} aria-label={t.changeStatus} className="input w-52">
                {["recibida", "analisis", "referida", "espera"].map((k) => <option key={k} value={k}>{QR_STATUS_TEXT[lang][k]}</option>)}
              </select>
              <SubmitButton className="btn-secondary">{t.changeStatus}</SubmitButton>
            </ActionForm>
          )}
          {manager && (
            <ActionForm action={generateReportAction}>{hidden}<SubmitButton className="btn-secondary"><FileText className="h-4 w-4" />{t.genReport}</SubmitButton></ActionForm>
          )}
        </div>
      </div>

      <ol className="flex flex-wrap gap-1.5" aria-label={t.fStatus}>
        {FLOW.map((k, i) => (
          <li key={k} className={`rounded-full px-3 py-1 text-xs font-semibold ${i < ci ? "bg-emerald-50 text-emerald-700" : i === ci ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-500"}`}>{i < ci ? "✓ " : ""}{QR_STATUS_TEXT[lang][k]}</li>
        ))}
        {c.status === "espera" && <li className="rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white">{QR_STATUS_TEXT[lang].espera}</li>}
      </ol>
      {!work && c.status !== "cerrada" && <p className="rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-800">{manager ? t.readOnlyOther : t.readOnlyOwn}</p>}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="card min-w-0 p-0">
          <nav className="flex overflow-x-auto border-b border-slate-100 px-2" aria-label={t.colCase}>
            {TABS.map((k) => (
              <Link key={k} href={`/quejas/${c.number}?tab=${k}`} aria-current={tab === k ? "page" : undefined} className={`-mb-px whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold ${tab === k ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
                {tabLabel[k]}{counts[k] != null && <span className="ml-1 rounded-full bg-slate-100 px-1.5 text-xs text-slate-600">{counts[k]}</span>}
              </Link>
            ))}
          </nav>
          <div className="space-y-4 p-5">
            {tab === "resumen" && (
              <>
                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t.subject}</div>
                  <div className="font-semibold text-slate-900">{c.subject}</div>
                  <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{t.description}</div>
                  <p className="whitespace-pre-line text-sm text-slate-800">{c.description}</p>
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <section className="min-w-0 space-y-2">
                    <h3 className="flex items-center gap-2">{t.party} {c.partySigtur ? <span className="badge bg-violet-50 text-violet-700">{t.inSigturTag}</span> : <span className="badge bg-slate-100 text-slate-600">{t.noRut}</span>}</h3>
                    {kv([["RUT", c.partyRut], ["ID SIGTUR", c.partySigturId], [t.pName, c.partyName], ["Razón social", c.partyRazon], [t.pDoc, c.partyRnc], ["Estatus RNT", c.partyRntStatus], [t.pAddress, [c.partyAddress, c.partyMunicipality, c.partyProvince].filter(Boolean).join(", ")], [t.pPhone, c.partyPhone], [t.pEmail, c.partyEmail]])}
                    {c.partyRut && <Link href={`/quejas?status=open&status=cerrada&q=${encodeURIComponent(c.partyRut)}`} className="text-xs font-medium text-brand-700 hover:underline">{t.otherCases.replace("{n}", String(others))}</Link>}
                  </section>
                  <section className="min-w-0 space-y-2">
                    <h3>{t.presenter}</h3>
                    {c.complainantAnonymous ? <p className="text-sm text-slate-600">{t.anonymous}</p> : kv([[t.cName, c.complainantName], [t.cDoc, c.complainantDoc], [t.cNationality, c.complainantNationality], [t.pPhone, c.complainantPhone], [t.pEmail, c.complainantEmail]])}
                    <p className="text-xs text-slate-500">{t.personalNote}</p>
                  </section>
                </div>
              </>
            )}

            {tab === "pasos" && (
              <>
                {work && (
                  <ActionForm action={addStepAction} resetOnSuccess className="space-y-2 rounded-xl bg-slate-50 p-4">
                    {hidden}
                    <label className="label" htmlFor="step-text">{t.newStep}</label>
                    <textarea id="step-text" name="text" rows={3} className="input" placeholder={t.stepPh} required />
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="choice"><input type="radio" name="kind" value="public" defaultChecked className="accent-brand-600" /> {t.visible}</label>
                      <label className="choice"><input type="radio" name="kind" value="internal" className="accent-brand-600" /> {t.internal}</label>
                      <span className="flex-1" />
                      <SubmitButton>{t.addStep}</SubmitButton>
                    </div>
                  </ActionForm>
                )}
                <ol className="space-y-3" data-testid="qr-steps">
                  {d.steps.map((st) => (
                    <li key={st.id} className="flex gap-3">
                      <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${st.kind === "internal" ? "bg-amber-50 text-amber-700" : st.kind === "system" ? "bg-slate-100 text-slate-500" : "bg-brand-50 text-brand-700"}`}>{st.kind === "internal" ? "!" : st.kind === "system" ? "·" : "✓"}</span>
                      <div className="min-w-0">
                        <p className="whitespace-pre-line text-sm text-slate-900">{st.text}</p>
                        <p className="text-xs text-slate-500">{fmtDateTime(st.at, lang)} · {st.byName ?? "Sistema"} · {st.kind === "internal" ? t.internal : st.kind === "system" ? t.automatic : t.visible}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                <p className="text-xs text-slate-500">{t.stepsNote}</p>
              </>
            )}

            {tab === "referencias" && (
              <>
                {d.refs.length === 0 && <p className="text-sm text-slate-500">{t.noRefs}</p>}
                {d.refs.map((r) => (
                  <div key={r.id} className="space-y-2 rounded-xl bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <b>{r.institution}</b>
                      <span className={`badge ${r.response ? "bg-emerald-50 text-emerald-700" : r.dueOn && r.dueOn < todayLocal() ? "bg-red-50 text-mitur-red" : "bg-amber-50 text-amber-800"}`}>{r.response ? t.answered : t.waiting}</span>
                      <span className="text-xs text-slate-500">{t.sentOn.replace("{d}", fmtDate(r.sentOn, lang))}{r.dueOn ? ` · ${t.dueOn.replace("{d}", fmtDate(r.dueOn, lang))}` : ""}</span>
                    </div>
                    {r.note && <p className="text-sm text-slate-700">{r.note}</p>}
                    {r.response ? (
                      <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{t.answer}: {r.response}</p>
                    ) : work ? (
                      <ActionForm action={answerReferralAction} className="flex flex-wrap gap-2">
                        {hidden}
                        <input type="hidden" name="referralId" value={r.id} />
                        <input name="response" className="input min-w-0 flex-1" placeholder={t.responsePh} aria-label={t.responsePh} required />
                        <SubmitButton className="btn-secondary">{t.saveResponse}</SubmitButton>
                      </ActionForm>
                    ) : null}
                  </div>
                ))}
                {work && (
                  <ActionForm action={referAction} resetOnSuccess className="space-y-3 rounded-xl border border-slate-200 p-4">
                    {hidden}
                    <h3>{t.referTo}</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div><label className="label" htmlFor="ref-inst">{t.institution}</label><select id="ref-inst" name="institution" className="input">{s.institutions.map((x) => <option key={x}>{x}</option>)}</select></div>
                      <div><label className="label" htmlFor="ref-due">{t.expected}</label><input id="ref-due" name="dueOn" type="date" className="input" /></div>
                    </div>
                    <div><label className="label" htmlFor="ref-note">{t.referNote}</label><textarea id="ref-note" name="note" rows={2} className="input" /></div>
                    <div className="flex justify-end"><SubmitButton>{t.refer}</SubmitButton></div>
                  </ActionForm>
                )}
              </>
            )}

            {tab === "pruebas" && (
              <>
                {work && <FileUploader number={c.number} t={t} />}
                {d.files.length === 0 ? <p className="text-sm text-slate-500">{t.noFiles}</p> : (
                  <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="qr-files">
                    {d.files.map((f) => (
                      <li key={f.id} className={`overflow-hidden rounded-xl border border-slate-200 ${f.replacedAt ? "opacity-60" : ""}`}>
                        <a href={`/api/quejas/files/${f.id}`} target="_blank" rel="noreferrer" className="block">
                          {f.mime.startsWith("image/") ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={`/api/quejas/files/${f.id}`} alt={f.name} className="aspect-[4/3] w-full bg-slate-100 object-cover" />
                          ) : (
                            <div className="grid aspect-[4/3] place-items-center bg-slate-50 text-slate-400"><Paperclip className="h-8 w-8" /></div>
                          )}
                        </a>
                        <div className="space-y-1 p-3 text-xs">
                          <a href={`/api/quejas/files/${f.id}`} target="_blank" rel="noreferrer" className="block truncate font-semibold text-slate-900 hover:text-brand-700" title={f.name}>{f.name}</a>
                          <div className="text-slate-500">{Math.max(1, Math.round(f.size / 1024))} KB · {f.uploadedByName ?? "—"} · {fmtDate(f.at, lang)}{f.replacedAt ? ` · ${t.replaced}` : ""}</div>
                          {work && !f.replacedAt && (
                            <ActionForm action={markFileReplacedAction}>{hidden}<input type="hidden" name="fileId" value={f.id} /><SubmitButton className="text-xs font-semibold text-slate-500 hover:text-slate-800">{t.markReplaced}</SubmitButton></ActionForm>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-xs text-slate-500">{t.filesNote}</p>
              </>
            )}

            {tab === "solucion" && (
              <>
                {c.status === "cerrada" ? (
                  <>
                    <div><div className="label">{t.solution}</div><p className="whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm">{c.solution}</p></div>
                    <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{t.closedInfo.replace("{d}", fmtDateTime(c.closedAt, lang)).replace("{p}", nameOf(c.closeProposedBy)).replace("{a}", nameOf(c.closedBy))}</p>
                    {sup && (
                      <ActionForm action={reopenAction} className="flex flex-wrap gap-2">
                        {hidden}
                        <input name="reason" className="input min-w-0 flex-1" placeholder={t.reopenWhy} aria-label={t.reopenWhy} required />
                        <SubmitButton className="btn-secondary">{t.reopen}</SubmitButton>
                      </ActionForm>
                    )}
                  </>
                ) : c.status === "porcerrar" ? (
                  <>
                    <div><div className="label">{t.solution}</div><p className="whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm">{c.solution}</p></div>
                    <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{t.pendingApproval.replace("{p}", nameOf(c.closeProposedBy)).replace("{d}", fmtDateTime(c.closeProposedAt, lang))}{c.closeNote ? ` «${c.closeNote}»` : ""}</p>
                    {sup && c.closeProposedBy !== u.id && (
                      <div className="flex flex-wrap gap-2">
                        <ActionForm action={approveCloseAction}>{hidden}<SubmitButton className="btn">{t.approve}</SubmitButton></ActionForm>
                        <ActionForm action={returnCloseAction} className="flex min-w-0 flex-1 flex-wrap gap-2">
                          {hidden}
                          <input name="reason" className="input min-w-0 flex-1" placeholder={t.returnWhy} aria-label={t.returnWhy} required />
                          <SubmitButton className="btn-secondary">{t.giveBack}</SubmitButton>
                        </ActionForm>
                      </div>
                    )}
                    {sup && c.closeProposedBy === u.id && <p className="text-sm text-slate-500">{t.ownProposal}</p>}
                  </>
                ) : work ? (
                  <ActionForm action={proposeCloseAction} className="space-y-3">
                    {hidden}
                    <div><label className="label" htmlFor="sol">{t.solution}</label><textarea id="sol" name="solution" rows={4} className="input" placeholder={t.solutionPh} defaultValue={c.solution ?? ""} required /></div>
                    <div className="flex flex-wrap gap-2">
                      <input name="note" className="input min-w-0 flex-1" placeholder={t.closeNotePh} aria-label={t.closeNotePh} />
                      <SubmitButton>{t.proposeClose}</SubmitButton>
                    </div>
                    <p className="text-xs text-slate-500">{t.proposeHelp}</p>
                  </ActionForm>
                ) : (
                  <p className="text-sm text-slate-500">{c.solution || "—"}</p>
                )}
              </>
            )}

            {tab === "informes" && (
              <>
                <p className="text-sm text-slate-600">{t.reportsHelp}</p>
                {d.reports.length === 0 ? <p className="text-sm text-slate-500">{t.noReports}</p> : (
                  <table className="table" data-testid="qr-reports">
                    <thead><tr><th>{t.version}</th><th>{t.received}</th><th>{t.origin}</th><th /></tr></thead>
                    <tbody>
                      {d.reports.map((r) => (
                        <tr key={r.id}>
                          <td>v{r.version}</td>
                          <td className="whitespace-nowrap text-sm">{fmtDateTime(r.createdAt, lang)}</td>
                          <td className="text-sm">{r.origin === "auto" ? t.auto : `${t.onRequest} · ${r.byName ?? ""}`}</td>
                          <td className="text-right"><a href={`/api/quejas/reports/${r.id}`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">{t.download}</a></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card space-y-2 p-4 text-sm">
            <h3>{t.deadlines}</h3>
            <div>{t.firstAttention}: {c.firstDoneAt ? <span className="font-semibold text-emerald-700">{t.done}</span> : <>{fmtDate(c.firstDue, lang)} · {firstLeft < 0 ? <span className="font-semibold text-mitur-red">{t.overdue}</span> : t.daysLeft.replace("{n}", String(firstLeft))}</>}</div>
            <div>{t.answer}: {fmtDate(c.due, lang)} · {dl.tone === "closed" ? t.closedOn.replace("{d}", fmtDate(c.closedAt, lang)) : dl.left < 0 ? <span className="font-semibold text-mitur-red">{t.daysLate.replace("{n}", String(-dl.left))}</span> : t.daysLeft.replace("{n}", String(dl.left))}</div>
            <p className="text-xs text-slate-500">{t.slaNote.replace("{t}", QR_TYPE_TEXT[lang][c.type]).replace("{f}", String(s.sla[c.type]?.first ?? "—")).replace("{r}", String(s.sla[c.type]?.resp ?? "—"))}</p>
          </div>
          <div className="card space-y-2 p-4 text-sm">
            <h3>{t.responsible}</h3>
            {sup && c.status !== "cerrada" ? (
              <ActionForm action={assignAction} className="flex gap-2">
                {hidden}
                <select name="userId" defaultValue={c.assignedUserId ?? ""} className="input min-w-0 flex-1" aria-label={t.responsible}>
                  <option value="">{t.none}</option>
                  {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <SubmitButton className="btn-secondary">OK</SubmitButton>
              </ActionForm>
            ) : (
              <b>{c.assignedUserId ? nameOf(c.assignedUserId) : t.none}</b>
            )}
            <p className="text-xs text-slate-500">{t.registeredBy}: {c.createdBy ? nameOf(c.createdBy) : QR_CHANNEL_TEXT[lang][c.channel]}</p>
          </div>
          <div className="card space-y-1 p-4 text-sm">
            <h3>{t.forPerson}</h3>
            <p>{c.number}</p>
            <p className="text-xs text-slate-500">{t.forPersonHelp}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
