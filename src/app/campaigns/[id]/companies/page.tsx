import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { CopyPlus, Download, Search, Trash2, Users2 } from "lucide-react";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Avatar } from "@/components/Avatar";
import { CampaignFields } from "@/components/CampaignFields";
import { Overlay } from "@/components/Overlay";
import { RefreshButton } from "@/components/RefreshButton";
import { ReassignSelect, SelectAll } from "@/components/TaskSelection";
import { RemoveFromList } from "@/components/RemoveTasks";
import { TransferForm } from "@/components/TransferForm";
import { Empty, PriorityBadge, SigturTag, StatusBadge } from "@/components/ui";
import { db } from "@/db";
import { campaigns, companies, establishments, users } from "@/db/schema";
import { CALL_CODES, CODE_SHORT, codeLabel, codeTone, COMPANY_STATUSES, label } from "@/lib/catalog";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { getDict } from "@/lib/i18n-server";
import { requestDeadline } from "@/lib/sigtur";
import { removedCount, removedList } from "@/lib/remove";
import { TASK_FILTER_KEYS, taskWhere } from "@/lib/task-filters";
import { requireUser } from "@/lib/auth";
import { absentOn, workload } from "@/lib/team";
import { TRANSFERABLE } from "@/lib/transfer";
import { assignAction, bulkAssignAction, countTransferAction, previewRemovalAction, reassignCompanyAction, removeTasksAction, transferCampaignAction } from "../../../actions";

const PAGE = 200;
const TONES = { good: "bg-emerald-50 text-emerald-800", info: "bg-brand-50 text-brand-700", warn: "bg-amber-50 text-amber-800", bad: "bg-red-50 text-mitur-red", none: "" };

export default async function TasksPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const { t, lang } = await getDict();
  const me = await requireUser(["admin", "supervisor"]);
  const agents = await db.select().from(users).where(and(eq(users.active, true), inArray(users.role, ["agent", "supervisor", "admin"]))).orderBy(asc(users.name));
  const [load, absent, byStatus, campaign] = await Promise.all([
    workload(agents.map((a) => a.id)),
    absentOn(),
    db.select({ status: companies.status, n: sql<number>`count(*)` }).from(companies).where(eq(companies.campaignId, id)).groupBy(companies.status),
    db.query.campaigns.findFirst({ where: eq(campaigns.id, id) }),
  ]);
  const statusCount = new Map(byStatus.map((s) => [s.status, Number(s.n)]));
  const zones = (await db.selectDistinct({ zone: companies.zone }).from(companies).where(eq(companies.campaignId, id))).map((z) => z.zone).filter(Boolean).sort() as string[];

  const where = taskWhere(id, sp);
  // Values for the extra filters, and the «Eliminadas» record.
  const [rnts, subs, codes, nRemoved] = await Promise.all([
    db.selectDistinct({ v: establishments.estatusRnt }).from(establishments).where(eq(establishments.campaignId, id)),
    db.selectDistinct({ v: establishments.subsector }).from(establishments).where(eq(establishments.campaignId, id)),
    db.selectDistinct({ v: companies.lastCode }).from(companies).where(eq(companies.campaignId, id)),
    removedCount(id),
  ]);
  const values = (rows: { v: string | null }[]) => rows.map((r) => r.v).filter((v): v is string => !!v).sort();
  const showRemoved = sp.view === "removed";
  const removed = showRemoved ? await removedList(id) : [];
  const activeFilters = Object.fromEntries(TASK_FILTER_KEYS.filter((k) => sp[k]).map((k) => [k, sp[k]!]));
  const idleDays = Math.max(1, Number(sp.days) || 3);
  const page = Math.max(0, Number(sp.page ?? 0));
  const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(companies).where(and(...where));
  const rows = await db.select().from(companies).where(and(...where)).orderBy(asc(companies.priority), asc(companies.razonSocial)).limit(PAGE).offset(page * PAGE);
  const names = rows.length
    ? await db.select({ companyId: establishments.companyId, name: establishments.nombreComercial, rut: establishments.rut }).from(establishments).where(inArray(establishments.companyId, rows.map((r) => r.id)))
    : [];
  const estBy = new Map(names.map((n) => [n.companyId, n]));
  const qs = (o: Record<string, string | number | undefined>) => "?" + new URLSearchParams(Object.entries({ ...sp, ...o }).filter(([, v]) => v !== undefined && v !== "") as [string, string][]).toString();
  const agentOptions = agents.map((a) => ({ id: a.id, name: a.name }));
  const nameById = new Map(agents.map((a) => [a.id, a.name]));
  const zoneCode = (z: string | null) => (z ? z.split(".")[0] : "—");

  return (
    <div className="space-y-4">
      {/* Toolbar: filters on one line + actions */}
      <div className="card p-4">
        <form className="grid gap-3 md:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto] md:items-end">
          <div>
            <label className="label">{t.search}</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input name="q" defaultValue={sp.q} className="input pl-9" placeholder="RUT, RNC, ID, nombre…" />
            </div>
          </div>
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
            <select name="zone" defaultValue={sp.zone ?? ""} className="input">
              <option value="">{t.all}</option>
              {zones.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t.followupFilter}</label>
            <div className="flex gap-2">
              <select name="f" defaultValue={sp.f ?? ""} className="input">
                <option value="">{t.all}</option>
                <option value="open">{t.fOpen}</option>
                <option value="due">{t.dueNow}</option>
                <option value="overdue">{t.fOverdue}</option>
                <option value="idle">{t.fIdle}</option>
                <option value="covered">{t.fCovered}</option>
                <option value="sigturOverdue">{t.fSigturOverdue}</option>
                <option value="opYes">{t.opYes}</option>
                <option value="opNo">{t.opNo}</option>
                <option value="opUnknown">{t.opUnknown}</option>
                <option value="opNone">{t.opNone}</option>
              </select>
              <input name="days" type="number" min={1} defaultValue={idleDays} className="input w-16 px-2" aria-label={t.fIdleDays} title={t.fIdleDays} />
            </div>
          </div>
          <button className="btn-secondary">{t.filter}</button>
          <div className="grid gap-3 md:col-span-full md:grid-cols-4">
            <div>
              <label className="label">{t.filterRnt}</label>
              <select name="rnt" defaultValue={sp.rnt ?? ""} className="input">
                <option value="">{t.all}</option>
                {values(rnts).map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t.filterSubsector}</label>
              <select name="sub" defaultValue={sp.sub ?? ""} className="input">
                <option value="">{t.all}</option>
                {values(subs).map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t.priority}</label>
              <select name="prio" defaultValue={sp.prio ?? ""} className="input">
                <option value="">{t.all}</option>
                {["P1", "P2", "P3"].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t.filterLastResult}</label>
              <select name="code" defaultValue={sp.code ?? ""} className="input">
                <option value="">{t.all}</option>
                {values(codes).map((v) => <option key={v} value={v}>{codeLabel(v, lang)}</option>)}
              </select>
            </div>
          </div>
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Overlay variant="drawer" trigger={<><Users2 className="h-4 w-4" />{t.assignTasks}</>} title={t.assignTitle}>
          <ActionForm action={assignAction} className="space-y-5">
            <input type="hidden" name="campaignId" value={id} />
            <div>
              <div className="label">{t.strategy}</div>
              <div className="space-y-2">
                {[["roundRobin", t.strategyRoundRobin], ["zone", t.strategyZone], ["single", t.strategySingle]].map(([v, l]) => (
                  <label key={v} className="choice"><input type="radio" name="strategy" value={v} defaultChecked={v === "roundRobin"} className="accent-brand-600" /> {l}</label>
                ))}
              </div>
              <label className="mt-2 flex items-start gap-2 text-sm text-slate-700">
                <input type="checkbox" name="workload" defaultChecked className="mt-0.5 h-4 w-4 accent-brand-600" />
                <span>{t.considerWorkload}<span className="block text-xs text-slate-500">{t.considerWorkloadHelp}</span></span>
              </label>
            </div>
            <div>
              <div className="label">{t.agents}</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {agents.map((a) => {
                  const off = absent.get(a.id);
                  return (
                    <label key={a.id} className="choice">
                      <input type="checkbox" name="agents" value={a.id} defaultChecked={a.role === "agent" && !off} className="h-4 w-4 accent-brand-600" />
                      <span className="min-w-0 flex-1">
                        {a.name}
                        <span className="block text-xs text-slate-500">{t.openLoad.replace("{n}", String(load.get(a.id) ?? 0))}</span>
                      </span>
                      {off && <span className="badge bg-amber-100 text-amber-800" title={`${off.fromDate} – ${off.toDate}`}>{t.absentTag}</span>}
                    </label>
                  );
                })}
              </div>
            </div>
            <details className="rounded-xl bg-slate-50 p-3">
              <summary className="cursor-pointer text-sm font-medium text-slate-700">{t.strategyZone}</summary>
              <div className="mt-3 space-y-2">
                {zones.map((z) => (
                  <div key={z} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 truncate" title={z}>{z}</span>
                    <select name={`zone:${z}`} className="input w-44 py-1.5">
                      <option value="">—</option>
                      {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </details>
            <div>
              <div className="label">{t.scope}</div>
              <div className="space-y-2">
                {[["unassigned", t.scopeUnassigned], ["notStarted", t.scopeNotStarted], ["open", t.scopeOpen]].map(([v, l]) => (
                  <label key={v} className="choice"><input type="radio" name="scope" value={v} defaultChecked={v === "unassigned"} className="accent-brand-600" /> {l}</label>
                ))}
              </div>
            </div>
            <div className="flex justify-end"><SubmitButton>{t.assign}</SubmitButton></div>
          </ActionForm>
        </Overlay>

        {/* Assign ticked rows */}
        <ActionForm id="bulk-assign" action={bulkAssignAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="campaignId" value={id} />
          <span className="text-sm text-slate-600">{t.assignSelected}</span>
          <select name="userId" className="input w-44 py-2" aria-label={t.assignSelected}>
            <option value="">{t.unassigned}</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <SubmitButton className="btn-secondary">{t.apply}</SubmitButton>
        </ActionForm>
        <span className="ml-auto" />
        {nRemoved > 0 && (
          <Link href={showRemoved ? `/campaigns/${id}/companies` : `/campaigns/${id}/companies?view=removed`} className="text-sm font-medium text-slate-600 hover:underline">
            {showRemoved ? t.removedBack : t.removedLink.replace("{n}", String(nRemoved))}
          </Link>
        )}
        {me.role === "admin" && campaign?.status !== "closed" && (
          <Overlay variant="drawer" triggerClassName="btn-secondary text-rose-700" trigger={<><Trash2 className="h-4 w-4" />{t.removeButton}</>} title={t.removeTitle.replace("{name}", campaign?.name ?? "")}>
            <RemoveFromList campaignId={id} filters={activeFilters} total={Number(total)} t={t} preview={previewRemovalAction} action={removeTasksAction} />
          </Overlay>
        )}
        <Overlay variant="drawer" width="max-w-2xl" triggerClassName="btn-secondary" trigger={<><CopyPlus className="h-4 w-4" />{t.transferButton}</>} title={t.transferButton}>
          <TransferForm
            campaignId={id}
            t={t}
            statuses={TRANSFERABLE.map((s) => ({ value: s, label: label(COMPANY_STATUSES, s, lang), n: statusCount.get(s) ?? 0 }))}
            codes={Object.keys(CALL_CODES).sort().map((k) => ({ value: k, label: codeLabel(k, lang) }))}
            zones={zones.map((z) => ({ value: z, label: z }))}
            priorities={["P1", "P2", "P3"].map((p) => ({ value: p, label: p }))}
            agents={agents.map((a) => ({ value: String(a.id), label: a.name }))}
            fields={<CampaignFields t={t} values={{ name: `${campaign?.name ?? ""} – seguimiento`, followupDays: campaign?.followupDays, maxAttempts: campaign?.maxAttempts }} />}
            action={transferCampaignAction}
            countAction={countTransferAction}
          />
        </Overlay>
        <RefreshButton label={t.refresh} />
      </div>

      {showRemoved ? (
        <div className="card overflow-hidden p-0">
          <div className="flex items-center justify-between px-5 pt-5">
            <h2 className="text-base">{t.removedTitle}</h2>
            <a href={`/api/campaigns/${id}/removed`} className="btn-secondary btn-sm"><Download className="h-3.5 w-3.5" />Excel</a>
          </div>
          <div className="overflow-x-auto">
            <table className="table" data-testid="removed-table">
              <thead><tr><th>{t.calledAtCol}</th><th>RUT</th><th>{t.company}</th><th>{t.removeReason}</th><th className="text-right">{t.calls}</th><th>{t.removedBy}</th></tr></thead>
              <tbody>
                {removed.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap text-sm">{fmtDateTime(r.removedAt, lang)}</td>
                    <td className="whitespace-nowrap font-mono text-xs">{r.rut}</td>
                    <td className="text-sm">{r.establishment}</td>
                    <td className="text-sm text-slate-600">{r.reason}</td>
                    <td className="text-right text-sm tabular-nums">{r.calls}</td>
                    <td className="whitespace-nowrap text-sm">{r.removedByName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : rows.length === 0 ? (
        <Empty>{t.noData}</Empty>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-10"><SelectAll form="bulk-assign" label={t.selectAll} /></th>
                  <th>{t.company}</th>
                  <th>{t.zone}</th>
                  <th>{t.status}</th>
                  <th>{t.lastResult}</th>
                  <th>{t.nextAction}</th>
                  <th>{t.assignedTo}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const e = estBy.get(c.id);
                  const name = e?.name ?? c.razonSocial ?? c.key;
                  const tone = codeTone(c.lastCode);
                  return (
                    <tr key={c.id}>
                      <td><input type="checkbox" name="ids" value={c.id} form="bulk-assign" className="h-4 w-4 accent-brand-600" aria-label={name} /></td>
                      <td className="min-w-[16rem]">
                        <div className="flex items-center gap-3">
                          <Avatar name={name} size="sm" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Link href={`/calls/${c.id}`} className="truncate font-medium text-slate-900 hover:text-brand-700">{name}</Link>
                              <PriorityBadge p={c.priority} />
                              {c.sigturRequest && <SigturTag by={c.requestedBy} reason={c.requestReason} t={t} deadline={requestDeadline(c)} lang={lang} />}
                            </div>
                            <div className="truncate text-xs text-slate-500">RUT {e?.rut} · RNC {c.rnc}</div>
                            {c.sigturRequest && (c.requestedBy || c.requestReason) && <div className="mt-0.5 truncate text-xs text-purple-800">{[c.requestedBy, c.requestReason].filter(Boolean).join(" · ")}</div>}
                            {c.originNote && <div className="mt-0.5 truncate text-xs text-violet-700" title={c.originNote}>{c.originNote}</div>}
                            {c.transferredToCampaignId && (
                              <Link href={`/campaigns/${c.transferredToCampaignId}/companies`} className="mt-0.5 block text-xs font-medium text-violet-700 hover:underline">{t.transferredTag}</Link>
                            )}
                            {c.coverFromUserId && (
                              <div className="mt-0.5 text-xs font-medium text-amber-700">
                                {(c.assignedUserId === c.coverUserId ? t.coveringTag : t.coverScheduledTag)
                                  .replace("{name}", nameById.get(c.coverFromUserId) ?? "—")
                                  .replace("{cover}", nameById.get(c.coverUserId ?? 0) ?? "—")}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td><span className="badge bg-slate-100 text-slate-700" title={c.zone ?? ""}>{zoneCode(c.zone)}</span></td>
                      <td className="whitespace-nowrap"><StatusBadge status={c.status} label={label(COMPANY_STATUSES, c.status, lang)} /></td>
                      <td className="whitespace-nowrap">
                        {c.lastCode ? (
                          <span className={`badge ${TONES[tone]}`} title={codeLabel(c.lastCode, lang)}>{label(CODE_SHORT, c.lastCode, lang)}{c.attempts > 1 ? ` · ${c.attempts}×` : ""}</span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-xs text-slate-600">{c.nextActionAt ? fmtDate(c.nextActionAt, lang) : "—"}</td>
                      <td>
                        <ReassignSelect key={c.assignedUserId ?? "none"} action={reassignCompanyAction} companyId={c.id} value={c.assignedUserId} options={agentOptions} unassignedLabel={t.unassigned} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {total > PAGE && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
              {page > 0 ? <Link className="btn-secondary btn-sm" href={qs({ page: page - 1 })}>←</Link> : <span />}
              <span className="text-slate-500">{page * PAGE + 1}–{Math.min(total, (page + 1) * PAGE)} / {total}</span>
              {(page + 1) * PAGE < total ? <Link className="btn-secondary btn-sm" href={qs({ page: page + 1 })}>→</Link> : <span />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
