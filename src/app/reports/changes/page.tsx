import { Download } from "lucide-react";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { BackLink } from "@/components/BackLink";
import { FilterChips } from "@/components/FilterChips";
import { MultiSelect } from "@/components/MultiSelect";
import { SelectAll } from "@/components/TaskSelection";
import { Empty } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { CHANGE_FIELDS, changeCampaigns, changeCounts, changeRows, type ChangeFilters } from "@/lib/changes";
import { fmtDateTime } from "@/lib/dates";
import { getDict } from "@/lib/i18n-server";
import { markChangesSigturAction } from "../../actions";

const PAGE = 200;

// «Reporte de cambios»: what changed in each establishment, to update SIGTUR by hand and mark it done.
export default async function ChangesPage({ searchParams }: { searchParams: Promise<ChangeFilters & { page?: string }> }) {
  await requireUser(["admin", "supervisor"]);
  const sp = await searchParams;
  const { t, lang } = await getDict();
  const page = Math.max(0, Number(sp.page) || 0);
  const filters: ChangeFilters = { campaign: sp.campaign, field: sp.field, state: sp.state, from: sp.from, to: sp.to, q: sp.q };
  const [rows, counts, camps] = await Promise.all([changeRows(filters, PAGE + 1, page * PAGE), changeCounts(filters), changeCampaigns()]);
  const hasMore = rows.length > PAGE;
  const groups = [
    { key: "campaign" as const, label: t.campaign, options: camps.map((c) => ({ value: String(c.id), label: c.name ?? "—" })) },
    { key: "field" as const, label: t.changesField, options: Object.entries(CHANGE_FIELDS).map(([k, v]) => ({ value: k, label: v[lang] })) },
    { key: "state" as const, label: t.changesState, options: [{ value: "pending", label: t.changesPending }, { value: "done", label: t.changesDone }] },
  ];
  const clean = Object.fromEntries(Object.entries(sp).filter(([k, v]) => v && k !== "page")) as Record<string, string>;
  const qs = (o: Record<string, string>) => "?" + new URLSearchParams({ ...clean, ...o }).toString();
  const sourceText = (s: string) => (lang === "en" ? ({ Llamada: "Call", Visita: "Visit", "Histórico": "History" } as Record<string, string>)[s] ?? s : s);

  return (
    <div className="space-y-6">
      <BackLink label={t.reportsTitle} />
      <div className="page-title">
        <div>
          <h1>{t.changesTitle}</h1>
          <p className="subtitle max-w-3xl">{t.changesSubtitle}</p>
        </div>
        <a href={`/api/changes${qs({})}`} className="btn-secondary"><Download className="h-4 w-4" />Excel</a>
      </div>
      <form className="card grid items-end gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]">
        {groups.map((g) => (
          <div key={g.key}>
            <label className="label" htmlFor={`f-${g.key}`}>{g.label}</label>
            <MultiSelect key={sp[g.key] ?? ""} id={`f-${g.key}`} name={g.key} value={sp[g.key]} options={g.options} t={t} />
          </div>
        ))}
        <div><label className="label" htmlFor="f-from">{t.from}</label><input id="f-from" type="date" name="from" defaultValue={sp.from} className="input" /></div>
        <div><label className="label" htmlFor="f-to">{t.to}</label><input id="f-to" type="date" name="to" defaultValue={sp.to} className="input" /></div>
        <div><label className="label" htmlFor="f-q">{t.search}</label><input id="f-q" name="q" defaultValue={sp.q} className="input" placeholder="RUT, ID, nombre…" /></div>
        <button className="btn-secondary">{t.filter}</button>
      </form>
      <FilterChips path="/reports/changes" sp={sp} groups={groups} keep={["from", "to", "q"]} t={t} />
      <p className="text-sm text-slate-600" data-testid="changes-count">{t.changesCount.replace("{n}", String(counts.total)).replace("{p}", String(counts.pending))}</p>

      {rows.length === 0 ? (
        <Empty>{t.changesNone}</Empty>
      ) : (
        <div className="card overflow-hidden p-0">
          <ActionForm id="changes-mark" action={markChangesSigturAction} resetOnSuccess className="flex flex-wrap items-center justify-end gap-2 border-b border-slate-100 px-4 py-3">
            <SubmitButton className="btn btn-sm">{t.changesMark}</SubmitButton>
          </ActionForm>
          <div className="overflow-x-auto">
            <table className="table" data-testid="changes-table">
              <thead>
                <tr>
                  <th className="w-10"><SelectAll form="changes-mark" label={t.selectAll} /></th>
                  <th>{t.when}</th><th>RUT / ID SIGTUR</th><th>{t.company}</th><th>{t.changesField}</th><th>{t.changesFrom}</th><th>{t.changesTo}</th><th>{t.who}</th><th>{t.changesState}</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, PAGE).map((r) => (
                  <tr key={r.id}>
                    <td>{!r.sigturDoneAt && <input type="checkbox" name="ids" value={r.id} form="changes-mark" className="h-4 w-4 accent-brand-600" aria-label={`${r.establishment ?? r.rut} · ${r.label}`} />}</td>
                    <td className="whitespace-nowrap text-sm">
                      {fmtDateTime(r.at, lang)}
                      {r.approximate && <div className="text-xs text-amber-700">{t.changesApprox}</div>}
                    </td>
                    <td className="whitespace-nowrap font-mono text-xs">{r.rut ?? "—"}<div className="text-slate-500">{r.sigturId ?? ""}</div></td>
                    <td className="text-sm">{r.establishment ?? "—"}<div className="text-xs text-slate-500">{r.campaignName ?? ""}</div></td>
                    <td className="whitespace-nowrap text-sm font-medium">{CHANGE_FIELDS[r.field]?.[lang] ?? r.label}</td>
                    <td className="max-w-[14rem] break-words text-sm text-slate-500 line-through decoration-slate-300">{r.fromValue ?? "—"}</td>
                    <td className="max-w-[14rem] break-words text-sm font-medium text-slate-900">{r.toValue ?? "—"}</td>
                    <td className="whitespace-nowrap text-sm">{r.byName ?? "—"}<div className="text-xs text-slate-500">{sourceText(r.source)}</div></td>
                    <td className="whitespace-nowrap text-sm">
                      {r.sigturDoneAt ? (
                        <span className="badge bg-emerald-50 text-emerald-700" title={t.changesDoneBy.replace("{name}", r.sigturDoneByName ?? "—").replace("{date}", fmtDateTime(r.sigturDoneAt, lang))}>{t.changesDone}</span>
                      ) : (
                        <span className="badge bg-amber-50 text-amber-800">{t.changesPending}</span>
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
