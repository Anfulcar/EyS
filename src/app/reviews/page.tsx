import { and, asc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { CallsTable } from "@/components/CallsTable";
import { Empty } from "@/components/ui";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { CALL_CODES } from "@/lib/catalog";
import { getDict } from "@/lib/i18n-server";
import { callCampaigns, callRows, canSeeAllCalls, type CallFilters } from "@/lib/reviews";

const PAGE = 100;

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
        <CallsTable
          rows={rows.slice(0, PAGE)}
          t={t}
          lang={lang}
          showAgent={all}
          pager={(page > 0 || hasMore) && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
              {page > 0 ? <Link className="btn-secondary btn-sm" href={qs({ page: String(page - 1) })}>←</Link> : <span />}
              <span className="text-slate-500">{page * PAGE + 1}–{page * PAGE + Math.min(rows.length, PAGE)}</span>
              {hasMore ? <Link className="btn-secondary btn-sm" href={qs({ page: String(page + 1) })}>→</Link> : <span />}
            </div>
          )}
        />
      )}
    </div>
  );
}
