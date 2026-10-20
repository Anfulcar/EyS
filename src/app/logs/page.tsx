import { asc } from "drizzle-orm";
import { Download } from "lucide-react";
import Link from "next/link";
import { Empty } from "@/components/ui";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ACTIVITY_LABELS, ERROR_SOURCES, label } from "@/lib/catalog";
import { fmtDateTime } from "@/lib/dates";
import { getDict } from "@/lib/i18n-server";
import { activityRows, errorRows, type LogFilters } from "@/lib/logs";

const PAGE = 100;

export default async function LogsPage({ searchParams }: { searchParams: Promise<LogFilters & { tab?: string; page?: string }> }) {
  await requireUser(["admin"]);
  const sp = await searchParams;
  const { t, lang } = await getDict();
  const tab = sp.tab === "errors" ? "errors" : "activity";
  const page = Math.max(0, Number(sp.page) || 0);
  const people = await db.select({ id: users.id, name: users.name }).from(users).orderBy(asc(users.name));
  const names = new Map(people.map((p) => [p.id, p.name]));
  const filters: LogFilters = { action: sp.action, user: sp.user, q: sp.q, from: sp.from, to: sp.to, source: sp.source };
  const rows = tab === "activity" ? await activityRows(filters, PAGE + 1, page * PAGE) : await errorRows(filters, PAGE + 1, page * PAGE);
  const hasMore = rows.length > PAGE;
  const clean = Object.fromEntries(Object.entries({ ...sp }).filter(([, v]) => v)) as Record<string, string>;
  const qs = (o: Record<string, string>) => "?" + new URLSearchParams({ ...clean, ...o }).toString();

  return (
    <div className="space-y-6">
      <div className="page-title">
        <div>
          <h1>{t.logsTitle}</h1>
          <p className="subtitle">{t.logsSubtitle}</p>
        </div>
        <a href={`/api/logs${qs({ tab })}`} className="btn-secondary"><Download className="h-4 w-4" />{t.downloadCsv}</a>
      </div>
      <nav className="segmented">
        <Link href="?tab=activity" aria-current={tab === "activity" ? "page" : undefined}>{t.tabActivity}</Link>
        <Link href="?tab=errors" aria-current={tab === "errors" ? "page" : undefined}>{t.tabErrors}</Link>
      </nav>
      <form className="card grid items-end gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))]">
        <input type="hidden" name="tab" value={tab} />
        {tab === "activity" ? (
          <>
            <div>
              <label className="label">{t.what}</label>
              <select name="action" defaultValue={sp.action ?? ""} className="input">
                <option value="">{t.all}</option>
                {Object.entries(ACTIVITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v[lang]}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t.who}</label>
              <select name="user" defaultValue={sp.user ?? ""} className="input">
                <option value="">{t.all}</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </>
        ) : (
          <div>
            <label className="label">{t.source}</label>
            <select name="source" defaultValue={sp.source ?? ""} className="input">
              <option value="">{t.all}</option>
              {Object.entries(ERROR_SOURCES).map(([k, v]) => <option key={k} value={k}>{v[lang]}</option>)}
            </select>
          </div>
        )}
        <div><label className="label">{t.from}</label><input type="date" name="from" defaultValue={sp.from} className="input" /></div>
        <div><label className="label">{t.to}</label><input type="date" name="to" defaultValue={sp.to} className="input" /></div>
        <div><label className="label">{t.search}</label><input name="q" defaultValue={sp.q} className="input" /></div>
        <button className="btn-secondary">{t.filter}</button>
      </form>
      {rows.length === 0 ? (
        <Empty>{t.noLogs}</Empty>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="table">
            <thead>
              {tab === "activity" ? (
                <tr><th>{t.when}</th><th>{t.who}</th><th>{t.what}</th><th>{t.detail}</th></tr>
              ) : (
                <tr><th>{t.when}</th><th>{t.source}</th><th>{t.page}</th><th>{t.detail}</th><th>{t.who}</th></tr>
              )}
            </thead>
            <tbody>
              {rows.slice(0, PAGE).map((r) =>
                "action" in r ? (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap text-xs text-slate-500">{fmtDateTime(r.at, lang)}</td>
                    <td className="whitespace-nowrap">{r.userName ?? "—"}</td>
                    <td className="whitespace-nowrap font-medium">{label(ACTIVITY_LABELS, r.action, lang)}</td>
                    <td className="text-slate-600">{r.summary}</td>
                  </tr>
                ) : (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap text-xs text-slate-500">{fmtDateTime(r.at, lang)}</td>
                    <td><span className="badge bg-rose-50 text-rose-700">{label(ERROR_SOURCES, r.source, lang)}</span></td>
                    <td className="font-mono text-xs">{r.path}</td>
                    <td className="max-w-xl text-slate-700">{r.message}{r.digest && <span className="ml-1 text-xs text-slate-400">({r.digest})</span>}</td>
                    <td className="whitespace-nowrap text-xs">{r.userId ? names.get(r.userId) : "—"}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
          {(page > 0 || hasMore) && (
            <div className="flex justify-between px-4 py-3">
              {page > 0 ? <Link className="btn-secondary btn-sm" href={qs({ page: String(page - 1) })}>←</Link> : <span />}
              {hasMore ? <Link className="btn-secondary btn-sm" href={qs({ page: String(page + 1) })}>→</Link> : <span />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
