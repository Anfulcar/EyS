import { ArrowLeft, CheckCircle2, ClipboardCheck, ExternalLink, Phone, Send } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { SectionTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { codeLabel, label, OBSTACLES } from "@/lib/catalog";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { getDict } from "@/lib/i18n-server";
import { callDetail, canSeeAllCalls } from "@/lib/reviews";
import { buildInteractions } from "@/lib/sigtur";
import { reviewCallAction } from "../../actions";

export default async function CallSummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser(["admin", "supervisor", "agent"]);
  const id = Number((await params).id);
  // Agents can only open their own calls; anything else answers "not found".
  const c = Number.isInteger(id) ? await callDetail(me, id) : null;
  if (!c) notFound();
  const { t, lang } = await getDict();
  const manager = canSeeAllCalls(me);
  // The same record SIGTUR reads through the integration (one per establishment in the call).
  const interactions = await buildInteractions({ attemptId: id });
  const a = c.a;
  const yn = (v: boolean | null) => (v == null ? "—" : v ? t.yes : t.no);
  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
    <div className="grid grid-cols-[10rem_minmax(0,1fr)] gap-3 py-1.5 text-sm">
      <dt className="text-slate-500">{k}</dt>
      <dd className="text-slate-900">{v || "—"}</dd>
    </div>
  );

  return (
    <div className="space-y-6">
      <Link href="/reviews" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" />{t.backToCalls}</Link>

      <div className="page-title">
        <div>
          <h1>{c.name}</h1>
          <p className="subtitle">{c.rut ? `RUT ${c.rut} · ` : ""}RNC {c.company.rnc} · {c.campaign}</p>
        </div>
        {(manager || c.company.assignedUserId === me.id) && (
          <Link href={`/calls/${a.companyId}`} className="btn-secondary"><ExternalLink className="h-4 w-4" />{t.openTask}</Link>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <div className="card">
            <SectionTitle icon={<Phone className="h-4 w-4" />}>{t.callSummary}</SectionTitle>
            <dl className="divide-y divide-slate-100">
              <Row k={t.calledAtCol} v={fmtDateTime(a.calledAt, lang)} />
              <Row k={t.agent} v={c.agent} />
              <Row k={t.phoneNumber} v={a.phoneNumber && <span className="font-mono">{a.phoneNumber}</span>} />
              <Row k={t.attemptNo} v={String(a.attemptNo)} />
              {a.noContactCode ? (
                <Row k={t.result} v={<span className="font-medium text-amber-700">{codeLabel(a.noContactCode, lang)}</span>} />
              ) : (
                <>
                  <Row k={t.spokeWithLabel} v={a.spokeWith} />
                  <Row k={t.spokeRoleLabel} v={a.spokeRole} />
                  <Row k={t.isResponsibleLabel} v={yn(a.isResponsible)} />
                  <Row k={t.attendedLabel} v={yn(a.attended)} />
                </>
              )}
              <Row k="WhatsApp" v={yn(a.whatsappSent)} />
              <Row k={t.callNotesLabel} v={a.notes} />
            </dl>
          </div>

          {!a.noContactCode && c.results.map(({ r, name, sigturId, rut }) => (
            <div key={r.id} className="card">
              <h2 className="mb-2 text-base">{name ?? sigturId}{rut ? <span className="ml-2 text-xs font-normal text-slate-500">RUT {rut}</span> : null}</h2>
              <dl className="divide-y divide-slate-100">
                <Row k={t.result} v={<span className="font-medium text-emerald-700">{codeLabel(r.code, lang)}</span>} />
                <Row k={t.operatingLabel} v={r.enOperacion} />
                {r.commitmentDate && <Row k={t.qCommitment} v={fmtDate(r.commitmentDate, lang)} />}
                {r.closedSince && <Row k={t.closedSinceLabel} v={r.closedSince} />}
                {r.obstacle && <Row k={t.qObstacle} v={label(OBSTACLES, r.obstacle, lang)} />}
                {r.notes && <Row k={t.notes} v={r.notes} />}
              </dl>
            </div>
          ))}
        </div>

        <aside className="space-y-6">
          <div className="card space-y-3">
            <SectionTitle icon={<ClipboardCheck className="h-4 w-4" />}>{t.reviewState}</SectionTitle>
            {a.reviewedAt ? (
              <div className="rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
                <div className="flex items-center gap-1.5 font-medium"><CheckCircle2 className="h-4 w-4" />{t.reviewedByOn.replace("{name}", c.reviewerName ?? "—").replace("{date}", fmtDateTime(a.reviewedAt, lang))}</div>
                {a.reviewComment && <p className="mt-1.5 whitespace-pre-line">{a.reviewComment}</p>}
              </div>
            ) : (
              <p className="text-sm text-slate-500">{t.notReviewed}</p>
            )}
            {manager && (
              <ActionForm action={reviewCallAction} className="space-y-3">
                <input type="hidden" name="attemptId" value={a.id} />
                <div>
                  <label className="label" htmlFor="review-comment">{t.reviewCommentLabel}</label>
                  <textarea key={a.reviewedAt ?? "new"} id="review-comment" name="comment" rows={4} maxLength={2000} defaultValue={a.reviewComment ?? ""} className="input" />
                </div>
                <SubmitButton>{a.reviewedAt ? t.updateReview : t.markReviewed}</SubmitButton>
              </ActionForm>
            )}
          </div>

          <div className="card space-y-3">
            <SectionTitle icon={<Send className="h-4 w-4" />}>{t.interactionsTitle}</SectionTitle>
            <p className="text-xs text-slate-500">{t.interactionsHelp}</p>
            {interactions.map((i) => (
              <dl key={i.id} className="rounded-xl bg-slate-50 px-3 py-2 text-xs">
                {([
                  ["ID SIGTUR", i.idSigtur], ["RUT", i.rut], ["Canal", i.canal], ["Fecha y hora", fmtDateTime(i.fechaHora, lang)],
                  ["Realizado por", i.realizadoPor], ["Número", i.numeroMarcado], ["Contacto", [i.personaContactada, i.cargo].filter(Boolean).join(" · ")],
                  ["Resultado", i.resultado], ["Compromiso", i.fechaCompromiso && fmtDate(i.fechaCompromiso, lang)], ["Obstáculo", i.obstaculo], ["Notas", i.notas],
                ] as const).filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2 py-0.5"><dt className="text-slate-500">{k}</dt><dd className="break-words text-slate-800">{v}</dd></div>
                ))}
              </dl>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
