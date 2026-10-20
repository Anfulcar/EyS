import { and, asc, eq, inArray } from "drizzle-orm";
import { CheckCircle2, Circle, MessageSquare } from "lucide-react";
import Link from "next/link";
import { Empty } from "@/components/ui";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { CALL_CODES, CODE_SHORT, codeLabel, codeTone, label } from "@/lib/catalog";
import { fmtDateTime } from "@/lib/dates";
import { getDict } from "@/lib/i18n-server";
import { callCampaigns, callRows, canSeeAllCalls, type CallFilters } from "@/lib/reviews";

const PAGE = 100;
const TONES = { good: "bg-emerald-50 text-emerald-800", info: "bg-brand-50 text-brand-700", warn: "bg-amber-50 text-amber-800", bad: "bg-red-50 text-mitur-red", none: "bg-slate-100 text-slate-600" };

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<CallFilters & { page?: string }> }) {
  const me = await requireUser(["admin", "supervisor", "agent"]);
  const sp = await searchParams;
  const { t, lang } = await getDict();
  const all = canSeeAllCalls(me);
  const page = Math.max(0, Number(sp.page) || 0);
  const filters: CallFilters = { campaign: sp.campaign, agent: sp.agent, code: sp.code, from: sp.from, to: sp.to, review: sp.review };
  const [rows, camps, agents] = await Promise.all([
    callRows(me, filters, PAGE + 1, page * PAGE),
    callCampaigns(me),
    all ? db.select({ id: users.id, name: users.name }).from(users).where(and(inArray(users.role, ["agent", "supervisor", "admin"]), eq(users.active, true))).orderBy(asc(users.name)) : [],
  ]);
  const hasMore = rows.length > PAGE;
  const clean = Object.fromEntries(Object.entries({ ...sp }).filter(([, v]) => v)) as Record<string, string>;
  const qs = (o: Record<string, string>) => "?" + new URLSearchParams({ ...clean, ...o }).toString();

  return (
    <div className="space-y-6">
      <div className="page-title">
        <div>
          <h1>{t.reviewsTitle}</h1>
          <p className="subtitle">{all ? t.reviewsSubManager : t.reviewsSubAgent}</p>
        </div>
      </div>
      <form className="card grid items-end gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))]">
        <div>
          <label className="label">{t.campaign}</label>
          <select name="campaign" defaultValue={sp.campaign ?? ""} className="input">
            <option value="">{t.all}</option>
            {camps.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {all && (
          <div>
            <label className="label">{t.agent}</label>
            <select name="agent" defaultValue={sp.agent ?? ""} className="input">
              <option value="">{t.all}</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="label">{t.result}</label>
          <select name="code" defaultValue={sp.code ?? ""} className="input">
            <option value="">{t.all}</option>
            {Object.entries(CALL_CODES).map(([k, v]) => <option key={k} value={k}>{v[lang]}</option>)}
          </select>
        </div>
        <div><label className="label">{t.from}</label><input type="date" name="from" defaultValue={sp.from} className="input" /></div>
        <div><label className="label">{t.to}</label><input type="date" name="to" defaultValue={sp.to} className="input" /></div>
        <div>
          <label className="label">{t.reviewState}</label>
          <select name="review" defaultValue={sp.review ?? ""} className="input">
            <option value="">{t.all}</option>
            <option value="no">{t.notReviewed}</option>
            <option value="yes">{t.reviewed}</option>
          </select>
        </div>
        <button className="btn-secondary">{t.filter}</button>
      </form>

      {rows.length === 0 ? (
        <Empty>{t.noCallsFound}</Empty>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t.calledAtCol}</th>
                  {all && <th>{t.agent}</th>}
                  <th>{t.company}</th>
                  <th>{t.phoneNumber}</th>
                  <th>{t.result}</th>
                  <th>{t.reviewState}</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, PAGE).map((r) => (
                  <tr key={r.a.id}>
                    <td className="whitespace-nowrap">
                      <Link href={`/reviews/${r.a.id}`} className="font-medium text-brand-700 hover:underline">{fmtDateTime(r.a.calledAt, lang)}</Link>
                    </td>
                    {all && <td className="whitespace-nowrap">{r.agent}</td>}
                    <td className="min-w-[14rem]">
                      <div className="font-medium text-slate-900">{r.name}</div>
                      <div className="text-xs text-slate-500">{r.rut ? `RUT ${r.rut} · ` : ""}{r.campaign}</div>
                    </td>
                    <td className="whitespace-nowrap font-mono text-sm">{r.a.phoneNumber ?? "—"}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {r.codes.map((c) => <span key={c} className={`badge ${TONES[codeTone(c)]}`} title={codeLabel(c, lang)}>{label(CODE_SHORT, c, lang)}</span>)}
                      </div>
                    </td>
                    <td className="whitespace-nowrap">
                      {r.a.reviewedAt ? (
                        <span className="inline-flex items-center gap-1 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />{t.reviewed}{r.a.reviewComment && <MessageSquare className="h-3.5 w-3.5" aria-label={t.reviewCommentLabel} />}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-sm text-slate-400"><Circle className="h-4 w-4" />{t.notReviewed}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(page > 0 || hasMore) && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
              {page > 0 ? <Link className="btn-secondary btn-sm" href={qs({ page: String(page - 1) })}>←</Link> : <span />}
              <span className="text-slate-500">{page * PAGE + 1}–{page * PAGE + Math.min(rows.length, PAGE)}</span>
              {hasMore ? <Link className="btn-secondary btn-sm" href={qs({ page: String(page + 1) })}>→</Link> : <span />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
