import { and, asc, eq, inArray, isNull, like, or, sql, type SQL } from "drizzle-orm";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Avatar } from "@/components/Avatar";
import { RefreshButton } from "@/components/RefreshButton";
import { PriorityBadge, StatusBadge } from "@/components/ui";
import { db } from "@/db";
import { companies, establishments, users } from "@/db/schema";
import { codeLabel, COMPANY_STATUSES, label } from "@/lib/catalog";
import { fmtDateTime } from "@/lib/dates";
import { getDict } from "@/lib/i18n-server";
import { assignAction, reassignCompanyAction } from "../../../actions";

const PAGE = 200;

export default async function CompaniesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const { t, lang } = await getDict();
  const agents = await db.select().from(users).where(and(eq(users.active, true), inArray(users.role, ["agent", "supervisor", "admin"]))).orderBy(asc(users.name));
  const zones = await db.selectDistinct({ zone: companies.zone }).from(companies).where(eq(companies.campaignId, id));

  const where: SQL[] = [eq(companies.campaignId, id)];
  if (sp.status) where.push(eq(companies.status, sp.status));
  if (sp.agent === "none") where.push(isNull(companies.assignedUserId));
  else if (sp.agent) where.push(eq(companies.assignedUserId, Number(sp.agent)));
  if (sp.zone) where.push(eq(companies.zone, sp.zone));
  if (sp.q) {
    const q = `%${sp.q}%`;
    where.push(or(like(companies.razonSocial, q), like(companies.rnc, q), sql`exists (select 1 from establishments e where e.company_id = ${companies.id} and (e.nombre_comercial like ${q} or e.sigtur_id like ${q} or e.rut like ${q}))`)!);
  }
  const page = Math.max(0, Number(sp.page ?? 0));
  const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(companies).where(and(...where));
  const rows = await db
    .select({ c: companies, agent: users.name })
    .from(companies)
    .leftJoin(users, eq(users.id, companies.assignedUserId))
    .where(and(...where))
    .orderBy(asc(companies.priority), asc(companies.razonSocial))
    .limit(PAGE)
    .offset(page * PAGE);
  const names = rows.length
    ? await db.select({ companyId: establishments.companyId, name: establishments.nombreComercial, rut: establishments.rut }).from(establishments).where(inArray(establishments.companyId, rows.map((r) => r.c.id)))
    : [];
  const estBy = new Map(names.map((n) => [n.companyId, n]));
  const qs = (o: Record<string, string | number | undefined>) => "?" + new URLSearchParams(Object.entries({ ...sp, ...o }).filter(([, v]) => v !== undefined && v !== "") as [string, string][]).toString();

  return (
    <div className="space-y-6">
      <ActionForm action={assignAction} className="card space-y-4">
        <h2>{t.assignTitle}</h2>
        <input type="hidden" name="campaignId" value={id} />
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">{t.strategy}</label>
            <div className="space-y-2">
              {[["roundRobin", t.strategyRoundRobin], ["zone", t.strategyZone], ["single", t.strategySingle]].map(([v, l]) => (
                <label key={v} className="choice flex items-center gap-2"><input type="radio" name="strategy" value={v} defaultChecked={v === "roundRobin"} /> {l}</label>
              ))}
            </div>
          </div>
          <div>
            <label className="label">{t.scope}</label>
            <div className="space-y-2">
              {[["unassigned", t.scopeUnassigned], ["notStarted", t.scopeNotStarted], ["open", t.scopeOpen]].map(([v, l]) => (
                <label key={v} className="choice flex items-center gap-2"><input type="radio" name="scope" value={v} defaultChecked={v === "unassigned"} /> {l}</label>
              ))}
            </div>
          </div>
        </div>
        <div>
          <label className="label">{t.agents} ({t.strategyRoundRobin.split("(")[0].trim()} / {t.strategySingle})</label>
          <div className="flex flex-wrap gap-2">
            {agents.map((a) => (
              <label key={a.id} className="choice flex items-center gap-2"><input type="checkbox" name="agents" value={a.id} defaultChecked={a.role === "agent"} /> {a.name}</label>
            ))}
          </div>
        </div>
        <details>
          <summary className="cursor-pointer text-sm font-medium text-slate-700">{t.strategyZone}</summary>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {zones.map((z) => (
              <div key={z.zone ?? "—"} className="flex items-center gap-2 text-sm">
                <span className="flex-1 truncate">{z.zone ?? "—"}</span>
                <select name={`zone:${z.zone ?? "—"}`} className="input w-48 py-1">
                  <option value="">—</option>
                  {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            ))}
          </div>
        </details>
        <SubmitButton>{t.assign}</SubmitButton>
      </ActionForm>

      <div className="card space-y-4 p-0">
        <form className="flex flex-wrap items-end gap-3 px-4 pt-4">
          <div><label className="label">{t.search}</label><input name="q" defaultValue={sp.q} className="input w-56" placeholder="RUT, RNC, ID, nombre…" /></div>
          <div>
            <label className="label">{t.status}</label>
            <select name="status" defaultValue={sp.status ?? ""} className="input">
              <option value="">{t.all}</option>
              {Object.entries(COMPANY_STATUSES).map(([k, v]) => <option key={k} value={k}>{v[lang]}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t.assignedTo}</label>
            <select name="agent" defaultValue={sp.agent ?? ""} className="input">
              <option value="">{t.all}</option>
              <option value="none">{t.unassigned}</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t.zone}</label>
            <select name="zone" defaultValue={sp.zone ?? ""} className="input max-w-xs">
              <option value="">{t.all}</option>
              {zones.map((z) => z.zone && <option key={z.zone} value={z.zone}>{z.zone}</option>)}
            </select>
          </div>
          <button className="btn-secondary">{t.filter}</button>
          <span className="ml-auto" />
          <RefreshButton label={t.refresh} />
        </form>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>{t.company}</th><th>{t.priority}</th><th>{t.zone}</th><th>{t.status}</th><th className="text-right">{t.attempts}</th><th>{t.lastResult}</th><th>{t.nextAction}</th><th>{t.assignedTo}</th></tr>
            </thead>
            <tbody>
              {rows.map(({ c }) => (
                <tr key={c.id}>
                  <td className="max-w-xs">
                    <div className="flex items-center gap-3">
                      <Avatar name={estBy.get(c.id)?.name ?? c.key} size="sm" />
                      <div className="min-w-0">
                        <Link href={`/calls/${c.id}`} className="block truncate font-medium text-slate-900 hover:text-brand-700">{estBy.get(c.id)?.name ?? c.razonSocial ?? c.key}</Link>
                        <div className="truncate text-xs text-slate-500">{c.razonSocial} · RUT {estBy.get(c.id)?.rut} · RNC {c.rnc}</div>
                      </div>
                    </div>
                  </td>
                  <td><PriorityBadge p={c.priority} /></td>
                  <td className="max-w-[10rem] truncate text-xs" title={c.zone ?? ""}>{c.zone}</td>
                  <td><StatusBadge status={c.status} label={label(COMPANY_STATUSES, c.status, lang)} /></td>
                  <td className="text-right tabular-nums">{c.attempts}</td>
                  <td className="max-w-[12rem] text-xs">{codeLabel(c.lastCode, lang)}</td>
                  <td className="text-xs">{fmtDateTime(c.nextActionAt, lang)}</td>
                  <td>
                    {/* key: remount when the assignment changes so the select shows the refreshed value */}
                    <form key={c.assignedUserId ?? "none"} action={reassignCompanyAction} className="flex gap-1">
                      <input type="hidden" name="companyId" value={c.id} />
                      <select name="userId" defaultValue={c.assignedUserId ?? ""} className="input w-40 py-1 text-xs">
                        <option value="">{t.unassigned}</option>
                        {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                      <button className="btn-secondary btn-sm">✓</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {total > PAGE && (
          <div className="flex justify-between px-4 pb-4 text-sm">
            {page > 0 ? <Link className="btn-secondary btn-sm" href={qs({ page: page - 1 })}>←</Link> : <span />}
            <span className="text-slate-500">{page * PAGE + 1}–{Math.min(total, (page + 1) * PAGE)} / {total}</span>
            {(page + 1) * PAGE < total ? <Link className="btn-secondary btn-sm" href={qs({ page: page + 1 })}>→</Link> : <span />}
          </div>
        )}
      </div>
    </div>
  );
}
