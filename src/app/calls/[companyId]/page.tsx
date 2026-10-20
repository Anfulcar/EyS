import { asc, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { CallForm } from "@/components/CallForm";
import { PriorityBadge, StatusBadge } from "@/components/ui";
import { db } from "@/db";
import { callAttempts, callResults, campaigns, establishments, phones, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { codeLabel, COMPANY_STATUSES, label, OBSTACLES, PHONE_KINDS, PHONE_REASONS } from "@/lib/catalog";
import { fmtDate, fmtDateTime, todayLocal } from "@/lib/dates";
import type { Dict } from "@/lib/i18n";
import { getDict } from "@/lib/i18n-server";
import { canWorkCompany } from "@/lib/workflow";
import { addPhoneAction, logCallAction } from "../../actions";

export default async function CompanyCallPage({ params }: { params: Promise<{ companyId: string }> }) {
  const me = await requireUser(["agent", "admin", "supervisor"]);
  const companyId = Number((await params).companyId);
  const company = await canWorkCompany(me, companyId);
  if (!company) notFound();
  const { t, lang } = await getDict();
  const [campaign, ests, phs, attempts] = await Promise.all([
    db.query.campaigns.findFirst({ where: eq(campaigns.id, company.campaignId) }),
    db.select().from(establishments).where(eq(establishments.companyId, companyId)).orderBy(asc(establishments.nombreComercial)),
    db.select().from(phones).where(eq(phones.companyId, companyId)).orderBy(desc(phones.active), asc(phones.id)),
    db
      .select({ a: callAttempts, agent: users.name })
      .from(callAttempts)
      .leftJoin(users, eq(users.id, callAttempts.userId))
      .where(eq(callAttempts.companyId, companyId))
      .orderBy(desc(callAttempts.calledAt)),
  ]);
  const results = attempts.length
    ? await db.select().from(callResults).where(inArray(callResults.attemptId, attempts.map((a) => a.a.id)))
    : [];
  const estName = new Map(ests.map((e) => [e.id, e.nombreComercial ?? e.sigturId]));
  const phoneById = new Map(phs.map((p) => [p.id, p]));
  const today = todayLocal();
  const outside = campaign && (campaign.status !== "active" || today < campaign.startDate || today > campaign.endDate);
  const activePhones = phs.filter((p) => p.active);

  return (
    <div className="space-y-5">
      <Link href="/calls" className="text-sm text-slate-500 hover:text-slate-800">← {t.myCallsTitle}</Link>
      <div className="flex flex-wrap items-center gap-3">
        <PriorityBadge p={company.priority} />
        <h1>{company.razonSocial ?? company.key}</h1>
        <StatusBadge status={company.status} label={label(COMPANY_STATUSES, company.status, lang)} />
        <span className="text-sm text-slate-500">RNC {company.rnc} · {campaign?.name} · {t.attempts}: {company.attempts}/{campaign?.maxAttempts}</span>
      </div>
      {outside && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{t.outsideDates}</p>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <details className="card">
            <summary className="cursor-pointer font-medium">{t.script}</summary>
            <p className="mt-2 text-sm text-slate-600">{t.scriptText}</p>
          </details>

          <div className="card space-y-3">
            <h2>{t.establishmentData} ({ests.length})</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {ests.map((e) => (
                <div key={e.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium">{e.nombreComercial}</div>
                    <PriorityBadge p={e.prioridad} />
                  </div>
                  <div className="text-xs text-slate-500">ID {e.sigturId} · {e.rut}</div>
                  <div className="mt-2 space-y-0.5 text-slate-700">
                    <div>
                      <span className={`badge ${e.estatusRnt === "Vencida" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{e.estatusRnt}</span>{" "}
                      {e.fechaVencimiento ? `${t.expiredOn} ${fmtDate(e.fechaVencimiento, lang)} (${e.tiempoVencida ?? ""})` : ""}
                    </div>
                    <div>{e.subsector} · {e.actividad}</div>
                    <div className="text-slate-500">{e.direccion}</div>
                    <div className="text-slate-500">{e.municipio}, {e.provincia} · {e.zonaOperativa}</div>
                    {e.correo && <div className="text-slate-500">✉ {e.correo}{e.correoRebotado === "Sí" ? " (rebotado)" : ""}</div>}
                    {e.correoEnviadoFecha && <div className="text-xs text-slate-400">{t.emailsSent}: {fmtDate(e.correoEnviadoFecha, lang)}</div>}
                  </div>
                  {e.finalCode && (
                    <div className="mt-2 rounded-lg bg-slate-50 px-2 py-1 text-xs">
                      <b>{codeLabel(e.finalCode, lang)}</b>
                      {e.fechaCompromiso && ` · ${t.qCommitment}: ${fmtDate(e.fechaCompromiso, lang)}`}
                      {e.requiereVisita === "Sí" && ` · ${t.qNeedsVisit}`}
                      {e.contactoNombre && ` · ${e.contactoNombre}${e.contactoCargo ? ` (${e.contactoCargo})` : ""}`}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <CallForm
            companyId={companyId}
            establishments={ests.map((e) => ({ id: e.id, name: e.nombreComercial ?? e.sigturId, status: e.estatusRnt }))}
            phones={activePhones.map((p) => ({ id: p.id, number: p.number, quality: p.quality }))}
            t={t}
            lang={lang}
            whatsappSuggested={company.whatsappSuggested}
            action={logCallAction}
          />

          <div className="card overflow-x-auto p-0">
            <h2 className="px-4 pt-4">{t.history}</h2>
            {attempts.length === 0 ? (
              <p className="px-4 pb-4 pt-2 text-sm text-slate-500">{t.noHistory}</p>
            ) : (
              <table className="table mt-2">
                <thead><tr><th>#</th><th>{t.date}</th><th>{t.agent}</th><th>{t.phoneNumber}</th><th>{t.result}</th><th>{t.notes}</th></tr></thead>
                <tbody>
                  {attempts.map(({ a, agent }) => {
                    const rs = results.filter((r) => r.attemptId === a.id);
                    return (
                      <tr key={a.id}>
                        <td>{a.attemptNo}</td>
                        <td className="whitespace-nowrap text-xs">{fmtDateTime(a.calledAt, lang)}</td>
                        <td className="text-xs">{agent}</td>
                        <td className="font-mono text-xs">{a.phoneNumber}</td>
                        <td className="text-xs">
                          {a.noContactCode ? (
                            codeLabel(a.noContactCode, lang)
                          ) : (
                            <>
                              <div className="text-slate-500">{a.spokeWith}{a.spokeRole ? ` (${a.spokeRole})` : ""}{a.isResponsible ? " ✓" : ""}</div>
                              {rs.map((r) => (
                                <div key={r.id}>
                                  <b>{estName.get(r.establishmentId)}:</b> {codeLabel(r.code, lang)}
                                  {r.commitmentDate && ` → ${fmtDate(r.commitmentDate, lang)}`}
                                  {r.obstacle && ` · ${label(OBSTACLES, r.obstacle, lang)}`}
                                  {r.notes && <span className="text-slate-500"> · {r.notes}</span>}
                                </div>
                              ))}
                            </>
                          )}
                          {a.whatsappSent && <div className="text-green-700">WhatsApp ✓</div>}
                        </td>
                        <td className="text-xs text-slate-600">{a.notes}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <aside className="space-y-5">
          <div className="card space-y-3">
            <h2>{t.phonesTitle}</h2>
            <ul className="space-y-2">
              {phs.map((p) => (
                <li key={p.id} className={`rounded-lg border px-3 py-2 ${p.active ? "border-slate-200" : "border-dashed border-slate-200 opacity-60"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`whitespace-nowrap font-mono text-lg ${p.quality === "wrong" || p.quality === "out_of_service" || !p.active ? "line-through" : ""}`}>{p.number}</span>
                    <span className="badge bg-slate-100 text-slate-600">{label(PHONE_KINDS, p.kind, lang)}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {!p.active && <span className="mr-1 font-medium">{t.phoneInactive}.</span>}
                    {p.quality !== "ok" && <span className="mr-1 text-red-600">{t[`phoneQuality_${p.quality}` as keyof Dict]}.</span>}
                    {p.reason && label(PHONE_REASONS, p.reason, lang)}
                    {p.reasonNote && ` – ${p.reasonNote}`}
                    {p.replacesPhoneId && ` (↺ ${phoneById.get(p.replacesPhoneId)?.number})`}
                  </div>
                </li>
              ))}
            </ul>
            <details>
              <summary className="btn-secondary btn-sm cursor-pointer list-none">+ {t.addPhone}</summary>
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
        </aside>
      </div>
    </div>
  );
}
