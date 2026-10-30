import { asc, desc, eq, inArray } from "drizzle-orm";
import { AlertTriangle, ArrowLeft, Building2, CheckCircle2, FileText, History, Mail, MapPin, Phone, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Avatar } from "@/components/Avatar";
import { CallForm, type RelatedTask } from "@/components/CallForm";
import { HistoryNotes, PriorityBadge, SectionTitle, SigturRequestNote, StatusBadge, historyShort, type HistoryNoteView } from "@/components/ui";
import { db } from "@/db";
import { callAttempts, callResults, campaigns, companies, establishments, phones, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { codeLabel, COMPANY_STATUSES, label, OBSTACLES, PHONE_KINDS, PHONE_REASONS } from "@/lib/catalog";
import { fmtDate, fmtDateTime, todayLocal } from "@/lib/dates";
import type { Dict } from "@/lib/i18n";
import { getDict } from "@/lib/i18n-server";
import { historyDay, historyFor } from "@/lib/history";
import { requestDeadline } from "@/lib/sigtur";
import { mayWork, relatedTasks } from "@/lib/workflow";
import { addPhoneAction, logCallAction } from "../../actions";

export default async function TaskPage({ params }: { params: Promise<{ companyId: string }> }) {
  const companyId = Number((await params).companyId);
  if (!Number.isInteger(companyId)) notFound();
  // Everything about the task is read at the same time as the account; nothing is shown
  // until the permission check below passes (others get "not found").
  const [me, companyRow, { t, lang }, ests, phs, attempts, results, people] = await Promise.all([
    requireUser(["agent", "admin", "supervisor"]),
    db.query.companies.findFirst({ where: eq(companies.id, companyId) }),
    getDict(),
    db.select().from(establishments).where(eq(establishments.companyId, companyId)).orderBy(asc(establishments.nombreComercial)),
    db.select().from(phones).where(eq(phones.companyId, companyId)).orderBy(desc(phones.active), asc(phones.id)),
    db
      .select({ a: callAttempts, agent: users.name })
      .from(callAttempts)
      .leftJoin(users, eq(users.id, callAttempts.userId))
      .where(eq(callAttempts.companyId, companyId))
      .orderBy(desc(callAttempts.calledAt)),
    db.select().from(callResults).where(inArray(callResults.attemptId, db.select({ id: callAttempts.id }).from(callAttempts).where(eq(callAttempts.companyId, companyId)))),
    db.select({ id: users.id, name: users.name }).from(users),
  ]);
  if (!companyRow || !mayWork(me, companyRow)) notFound();
  const company = companyRow;
  const [campaign, related] = await Promise.all([db.query.campaigns.findFirst({ where: eq(campaigns.id, company.campaignId) }), relatedTasks(company)]);
  const relIds = related.map((r) => r.id);
  const [relEsts, relPhones] = await Promise.all([
    relIds.length ? db.select().from(establishments).where(inArray(establishments.companyId, relIds)) : [],
    relIds.length ? db.select().from(phones).where(inArray(phones.companyId, relIds)) : [],
  ]);
  const names = new Map(people.map((p) => [p.id, p.name]));
  // Commitments and closures of the same RUTs (or closures of the same company) in other campaigns.
  const history: HistoryNoteView[] = (await historyFor(company.campaignId, [...ests, ...relEsts])).map((n) => ({ ...n, day: historyDay(n) }));
  const ownRuts = new Set(ests.map((e) => e.rut).filter(Boolean));
  const mainNotes = history.filter((n) => (n.rut && ownRuts.has(n.rut)) || (n.kind === "closed" && !(n.rut && ownRuts.has(n.rut)))).map((n) => ({ ...n, sameCompany: !(n.rut && ownRuts.has(n.rut)) }));
  const relatedTasksData: RelatedTask[] = related.map((r) => {
    const es = relEsts.filter((e) => e.companyId === r.id);
    return {
      id: r.id,
      name: es[0]?.nombreComercial ?? r.razonSocial ?? r.key,
      rut: es[0]?.rut ?? null,
      status: label(COMPANY_STATUSES, r.status, lang),
      rnt: es[0]?.estatusRnt ?? null,
      warning: history.filter((n) => n.rut && n.rut === es[0]?.rut).map((n) => historyShort(n, t, lang)).join(" · ") || null,
      agentName: r.assignedUserId ? names.get(r.assignedUserId) ?? null : null,
      canWork: me.role !== "agent" || r.assignedUserId === me.id,
      establishments: es.map((e) => ({ id: e.id, name: e.nombreComercial ?? e.sigturId, status: e.estatusRnt })),
      phones: relPhones.filter((p) => p.companyId === r.id && p.active).map((p) => ({ id: p.id, number: p.number, quality: p.quality })),
    };
  });
  const estName = new Map(ests.map((e) => [e.id, e.nombreComercial ?? e.sigturId]));
  const phoneById = new Map(phs.map((p) => [p.id, p]));
  const today = todayLocal();
  const outside = campaign && (campaign.status !== "active" || today < campaign.startDate || today > campaign.endDate);
  const activePhones = phs.filter((p) => p.active);
  const main = ests[0];
  const title = main?.nombreComercial ?? company.razonSocial ?? company.key;

  return (
    <div className="space-y-6">
      <Link href="/calls" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" />{t.myCallsTitle}</Link>

      <div className="card flex flex-wrap items-center gap-4">
        <Avatar name={title} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate">{title}</h1>
            <PriorityBadge p={company.priority} />
            <StatusBadge status={company.status} label={label(COMPANY_STATUSES, company.status, lang)} />
          </div>
          <p className="subtitle">{company.razonSocial} · RUT {main?.rut} · RNC {company.rnc} · {campaign?.name}</p>
        </div>
        <div className="text-right text-sm text-slate-500">
          <div>{t.attempts}</div>
          <div className="text-lg font-semibold text-slate-900">{company.attempts} / {campaign?.maxAttempts}</div>
        </div>
      </div>
      {company.sigturRequest && <SigturRequestNote by={company.requestedBy} reason={company.requestReason} t={t} deadline={requestDeadline(company)} lang={lang} />}
      <HistoryNotes notes={mainNotes} t={t} lang={lang} />
      {outside && <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800"><AlertTriangle className="h-4 w-4" />{t.outsideDates}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="space-y-6">
          <details className="card group">
            <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold"><FileText className="h-4 w-4 text-brand-600" />{t.script}</summary>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-600">{(lang === "en" ? campaign?.scriptEn || campaign?.scriptEs : campaign?.scriptEs) || t.scriptText}</p>
          </details>

          {company.status === "transferred" ? (
            <p className="rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-800">
              {t.transferredLocked}{" "}
              {company.transferredToCampaignId && <Link className="font-medium underline" href={`/campaigns/${company.transferredToCampaignId}/companies`}>{t.transferredTag}</Link>}
            </p>
          ) : (
          <CallForm
            companyId={companyId}
            establishments={ests.map((e) => ({ id: e.id, name: e.nombreComercial ?? e.sigturId, status: e.estatusRnt }))}
            currentEmail={ests.map((e) => e.correoActualizado ?? e.correo).find(Boolean) ?? null}
            phones={activePhones.map((p) => ({ id: p.id, number: p.number, quality: p.quality }))}
            related={relatedTasksData}
            t={t}
            lang={lang}
            whatsappSuggested={company.whatsappSuggested}
            action={logCallAction}
          />
          )}

          <div className="card">
            <SectionTitle icon={<History className="h-4 w-4" />}>{t.history}</SectionTitle>
            {company.originNote && <p className="mb-3 rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-800">{company.originNote}</p>}
            {attempts.length === 0 ? (
              <p className="text-sm text-slate-500">{t.noHistory}</p>
            ) : (
              <ol className="relative space-y-4 border-l-2 border-slate-100 pl-5">
                {attempts.map(({ a, agent }) => {
                  const rs = results.filter((r) => r.attemptId === a.id);
                  const ok = !a.noContactCode;
                  return (
                    <li key={a.id} className="relative">
                      <span className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-white ${ok ? "bg-emerald-500" : "bg-amber-400"}`} />
                      <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-slate-500">
                        <span className="font-medium text-slate-700">{fmtDateTime(a.calledAt, lang)}</span>
                        <span>· {agent}</span>
                        {a.phoneNumber && <span className="font-mono">· {a.phoneNumber}</span>}
                      </div>
                      <div className="mt-1 text-sm">
                        {a.noContactCode ? (
                          <span className="font-medium text-amber-700">{codeLabel(a.noContactCode, lang)}</span>
                        ) : (
                          <>
                            {a.spokeWith && <div className="text-slate-600">{a.spokeWith}{a.spokeRole ? ` (${a.spokeRole})` : ""}{a.isResponsible ? " ✓" : ""}</div>}
                            {rs.map((r) => (
                              <div key={r.id}>
                                {rs.length > 1 && <b>{estName.get(r.establishmentId)}: </b>}
                                <span className="font-medium text-emerald-700">{codeLabel(r.code, lang)}</span>
                                {r.commitmentDate && ` → ${fmtDate(r.commitmentDate, lang)}`}
                                {r.obstacle && <span className="text-slate-500"> · {label(OBSTACLES, r.obstacle, lang)}</span>}
                                {r.notes && <span className="text-slate-500"> · {r.notes}</span>}
                              </div>
                            ))}
                          </>
                        )}
                        {a.whatsappSent && <div className="text-xs text-green-700">WhatsApp ✓</div>}
                        {a.notes && <div className="text-xs text-slate-500">{a.notes}</div>}
                        {a.reviewedAt && (
                          <div className="mt-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-900">
                            <span className="inline-flex items-center gap-1 font-medium"><CheckCircle2 className="h-3.5 w-3.5" />{t.reviewedByOn.replace("{name}", (a.reviewedBy && names.get(a.reviewedBy)) || "—").replace("{date}", fmtDateTime(a.reviewedAt, lang))}</span>
                            {a.reviewComment && <div className="mt-0.5 whitespace-pre-line">{a.reviewComment}</div>}
                          </div>
                        )}
                        <Link href={`/reviews/${a.id}`} className="mt-1 inline-block text-xs font-medium text-brand-700 hover:underline">{t.callSummary} →</Link>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="card">
            <SectionTitle icon={<Phone className="h-4 w-4" />}>{t.phonesTitle}</SectionTitle>
            <ul className="space-y-2">
              {phs.map((p) => {
                const bad = p.quality === "wrong" || p.quality === "out_of_service" || !p.active;
                return (
                  <li key={p.id} className={`rounded-xl px-3 py-2.5 ${p.active ? "bg-slate-50" : "bg-white opacity-60 ring-1 ring-dashed ring-slate-200"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`whitespace-nowrap font-mono text-lg font-semibold text-slate-900 ${bad ? "line-through decoration-rose-400" : ""}`}>{p.number}</span>
                      <span className="badge bg-white text-slate-600 ring-1 ring-slate-200">{label(PHONE_KINDS, p.kind, lang)}</span>
                    </div>
                    {(p.reason || !p.active || p.quality !== "ok") && (
                      <div className="mt-1 text-xs text-slate-500">
                        {!p.active && <span className="mr-1 font-medium">{t.phoneInactive}.</span>}
                        {p.quality !== "ok" && <span className="mr-1 text-rose-600">{t[`phoneQuality_${p.quality}` as keyof Dict]}.</span>}
                        {p.reason && label(PHONE_REASONS, p.reason, lang)}
                        {p.reasonNote && ` – ${p.reasonNote}`}
                        {p.replacesPhoneId && ` (↺ ${phoneById.get(p.replacesPhoneId)?.number})`}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <details className="mt-3">
              <summary className="btn-secondary btn-sm cursor-pointer list-none"><Plus className="h-3.5 w-3.5" />{t.addPhone}</summary>
              <ActionForm action={addPhoneAction} className="mt-3 space-y-3" resetOnSuccess>
                <input type="hidden" name="companyId" value={companyId} />
                <div><label className="label">{t.phoneNumber}</label><input name="number" className="input font-mono" required placeholder="(809) 555-1234" /></div>
                <div>
                  <label className="label">{t.phoneKind}</label>
                  <select name="kind" className="input" required defaultValue="additional">
                    <option value="additional">{PHONE_KINDS.additional[lang]}</option>
                    <option value="substitute">{PHONE_KINDS.substitute[lang]}</option>
                  </select>
                </div>
                <div>
                  <label className="label">{t.phoneReplaces}</label>
                  <select name="replacesPhoneId" className="input">
                    <option value="">—</option>
                    {activePhones.map((p) => <option key={p.id} value={p.id}>{p.number}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">{t.phoneReason}</label>
                  <select name="reason" className="input" required defaultValue="">
                    <option value="" disabled>—</option>
                    {Object.entries(PHONE_REASONS).map(([k, v]) => <option key={k} value={k}>{v[lang]}</option>)}
                  </select>
                </div>
                <div><label className="label">{t.phoneReasonNote}</label><input name="reasonNote" className="input" /></div>
                <SubmitButton>{t.save}</SubmitButton>
              </ActionForm>
            </details>
          </div>

          {ests.map((e) => (
            <div key={e.id} className="card space-y-3 text-sm">
              <SectionTitle icon={<FileText className="h-4 w-4" />}>{t.establishmentData}</SectionTitle>
              <div className="flex flex-wrap gap-2">
                <span className={`badge ${e.estatusRnt === "Vencida" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>{e.estatusRnt}</span>
                <PriorityBadge p={e.prioridad} />
              </div>
              {e.fechaVencimiento && <div className="text-slate-700">{t.expiredOn} <b>{fmtDate(e.fechaVencimiento, lang)}</b>{e.tiempoVencida ? ` (${e.tiempoVencida})` : ""}</div>}
              <div className="text-slate-700">{e.subsector} · {e.actividad}</div>
              <div className="flex gap-2 text-slate-600"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><span>{e.direccion}<br /><span className="text-slate-500">{e.municipio}, {e.provincia} · {e.zonaOperativa}</span></span></div>
              {e.correo && <div className="flex gap-2 break-all text-slate-600"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />{e.correo}{e.correoRebotado === "Sí" ? " (rebotado)" : ""}</div>}
              <div className="text-xs text-slate-400">SIGTUR {e.sigturId}{e.correoEnviadoFecha ? ` · ${t.emailsSent}: ${fmtDate(e.correoEnviadoFecha, lang)}` : ""}</div>
              {e.finalCode && (
                <div className="rounded-xl bg-brand-50/60 px-3 py-2 text-xs text-brand-900">
                  <b>{codeLabel(e.finalCode, lang)}</b>
                  {e.fechaCompromiso && ` · ${t.qCommitment}: ${fmtDate(e.fechaCompromiso, lang)}`}
                  {e.requiereVisita === "Sí" && ` · ${t.qNeedsVisit}`}
                  {e.contactoNombre && ` · ${e.contactoNombre}${e.contactoCargo ? ` (${e.contactoCargo})` : ""}`}
                </div>
              )}
            </div>
          ))}

          {relatedTasksData.length > 0 && (
            <div className="card">
              <SectionTitle icon={<Building2 className="h-4 w-4" />}>{t.sameCompany}</SectionTitle>
              <ul className="space-y-2">
                {relatedTasksData.map((r) => (
                  <li key={r.id}>
                    {r.canWork ? (
                      <Link href={`/calls/${r.id}`} className="block rounded-xl bg-slate-50 px-3 py-2 transition hover:bg-brand-50">
                        <div className="truncate text-sm font-medium text-slate-900">{r.name}</div>
                        <div className="truncate text-xs text-slate-500">{r.rut}{r.rnt ? ` · RNT: ${r.rnt}` : ""} · {r.status}</div>
                        {r.warning && <div className="mt-0.5 truncate text-xs text-rose-700" title={r.warning}>⚠ {r.warning}</div>}
                      </Link>
                    ) : (
                      <div className="rounded-xl bg-slate-50 px-3 py-2 opacity-70">
                        <div className="truncate text-sm font-medium text-slate-900">{r.name}</div>
                        <div className="truncate text-xs text-slate-500">{r.rut}{r.rnt ? ` · RNT: ${r.rnt}` : ""} · {r.status} · {t.assignedToOther} {r.agentName ?? t.unassigned}</div>
                        {r.warning && <div className="mt-0.5 truncate text-xs text-rose-700" title={r.warning}>⚠ {r.warning}</div>}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
