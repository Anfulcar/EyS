import { and, asc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { CallsTable } from "@/components/CallsTable";
import { FilterChips } from "@/components/FilterChips";
import { MultiSelect } from "@/components/MultiSelect";
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
  // Campaign, agent and result accept several choices.
  const groups = [
    { key: "campaign" as const, label: t.campaign, options: camps.map((c) => ({ value: String(c.id), label: c.name })) },
    ...(all ? [{ key: "agent" as const, label: t.agent, options: agents.map((a) => ({ value: String(a.id), label: a.name })) }] : []),
    { key: "code" as const, label: t.result, options: Object.entries(CALL_CODES).map(([k, v]) => ({ value: k, label: v[lang] })) },
  ];
  const reviewGroup = { key: "review" as const, label: t.reviewState, options: [{ value: "no", label: t.notReviewed }, { value: "yes", label: t.reviewed }] };
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
        {groups.slice(0, 3).map((g) => (
          <div key={g.key}>
            <label className="label" htmlFor={`f-${g.key}`}>{g.label}</label>
            <MultiSelect key={sp[g.key] ?? ""} id={`f-${g.key}`} name={g.key} value={sp[g.key]} options={g.options} t={t} />
          </div>
        ))}
        <div><label className="label">{t.from}</label><input type="date" name="from" defaultValue={sp.from} className="input" /></div>
        <div><label className="label">{t.to}</label><input type="date" name="to" defaultValue={sp.to} className="input" /></div>
        <div>
          <label className="label" htmlFor="f-review">{t.reviewState}</label>
          <MultiSelect key={sp.review ?? ""} id="f-review" name="review" value={sp.review} options={reviewGroup.options} t={t} />
        </div>
        <button className="btn-secondary">{t.filter}</button>
      </form>
      <FilterChips path="/reviews" sp={sp} groups={[...groups, reviewGroup]} t={t} />

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
