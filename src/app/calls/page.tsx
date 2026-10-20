import { and, asc, eq, gt, inArray, isNull, lte, ne, or, sql, type SQL } from "drizzle-orm";
import Link from "next/link";
import { RefreshButton } from "@/components/RefreshButton";
import { Empty, PriorityBadge, StatusBadge } from "@/components/ui";
import { db } from "@/db";
import { campaigns, companies, establishments, phones, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { codeLabel, COMPANY_STATUSES, label } from "@/lib/catalog";
import { fmtDateTime, nowIso, todayLocal } from "@/lib/dates";
import { getDict } from "@/lib/i18n-server";

const TABS = ["due", "scheduled", "visit", "done"] as const;

export default async function CallsPage({ searchParams }: { searchParams: Promise<{ tab?: string; agent?: string; campaign?: string }> }) {
  const me = await requireUser(["agent", "admin", "supervisor"]);
  const sp = await searchParams;
  const { t, lang } = await getDict();
  const tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? sp.tab! : "due";
  const isManager = me.role !== "agent";
  const agentId = isManager && sp.agent ? Number(sp.agent) : me.id;
  const today = todayLocal();
  const now = nowIso();

  // Every campaign that is not closed: draft or out-of-dates campaigns are shown with a warning instead of hidden.
  const active = await db.select().from(campaigns).where(ne(campaigns.status, "closed"));
  const warnings = active.filter((c) => c.status !== "active" || today < c.startDate || today > c.endDate);
  const campaignIds = active.map((c) => c.id).filter((id) => !sp.campaign || id === Number(sp.campaign));

  const base: SQL[] = [inArray(companies.campaignId, campaignIds.length ? campaignIds : [-1]), eq(companies.assignedUserId, agentId)];
  const filters: Record<string, SQL> = {
    due: and(inArray(companies.status, ["pending", "retry", "followup"]), or(isNull(companies.nextActionAt), lte(companies.nextActionAt, now)))!,
    scheduled: and(inArray(companies.status, ["retry", "followup"]), gt(companies.nextActionAt, now))!,
    visit: eq(companies.status, "visit"),
    done: eq(companies.status, "done"),
  };
  const counts = Object.fromEntries(
    await Promise.all(
      TABS.map(async (k) => [k, (await db.select({ n: sql<number>`count(*)` }).from(companies).where(and(...base, filters[k])))[0].n] as const),
    ),
  );
  const rows = await db
    .select()
    .from(companies)
    .where(and(...base, filters[tab]))
    .orderBy(sql`case when ${companies.nextActionAt} is null then 1 else 0 end`, asc(companies.nextActionAt), asc(companies.priority), asc(companies.attempts))
    .limit(300);
  const ids = rows.map((r) => r.id);
  const [ests, phs] = ids.length
    ? await Promise.all([
        db.select({ companyId: establishments.companyId, name: establishments.nombreComercial, status: establishments.estatusRnt }).from(establishments).where(inArray(establishments.companyId, ids)),
        db.select({ companyId: phones.companyId, number: phones.number, quality: phones.quality }).from(phones).where(and(inArray(phones.companyId, ids), eq(phones.active, true))),
      ])
    : [[], []];
  const estBy = new Map<number, typeof ests>();
  for (const e of ests) estBy.set(e.companyId, [...(estBy.get(e.companyId) ?? []), e]);
  const phBy = new Map<number, typeof phs>();
  for (const p of phs) phBy.set(p.companyId, [...(phBy.get(p.companyId) ?? []), p]);
  const agents = isManager ? await db.select().from(users).where(eq(users.active, true)).orderBy(asc(users.name)) : [];
  const campaignName = new Map(active.map((c) => [c.id, c.name]));
  const qs = (o: Record<string, string>) => "?" + new URLSearchParams({ ...(sp as Record<string, string>), ...o }).toString();
  const tabLabels: Record<string, string> = { due: t.dueNow, scheduled: t.scheduled, visit: t.sentToVisit, done: t.finished };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1>{t.myCallsTitle}</h1>
          <RefreshButton label={t.refresh} />
        </div>
        <form className="flex flex-wrap gap-2">
          <input type="hidden" name="tab" value={tab} />
          {active.length > 1 && (
            <select name="campaign" defaultValue={sp.campaign ?? ""} className="input w-56">
              <option value="">{t.navCampaigns}: {t.all}</option>
              {active.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {isManager && (
            <select name="agent" defaultValue={String(agentId)} className="input w-48">
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          {(active.length > 1 || isManager) && <button className="btn-secondary">{t.filter}</button>}
        </form>
      </div>
      {warnings.map((c) => (
        <p key={c.id} className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {c.name}: {c.status === "draft" ? t.campaignDraftWarning : t.outsideDates}
        </p>
      ))}
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((k) => (
          <Link key={k} href={qs({ tab: k })} className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${tab === k ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            {tabLabels[k]} <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{counts[k]}</span>
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <Empty>{t.noCalls}</Empty>
      ) : (
        <div className="space-y-2">
          {rows.map((c) => {
            const list = estBy.get(c.id) ?? [];
            return (
              <Link key={c.id} href={`/calls/${c.id}`} className="card flex flex-wrap items-start gap-4 p-4 transition hover:border-brand-500">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <PriorityBadge p={c.priority} />
                    <span className="font-semibold">{c.razonSocial ?? c.key}</span>
                    {c.whatsappSuggested && <span className="badge bg-green-50 text-green-700">WhatsApp</span>}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {c.rnc} · {list.length} {t.establishments.toLowerCase()} · {c.zone}
                    {active.length > 1 && ` · ${campaignName.get(c.campaignId)}`}
                  </div>
                  <div className="mt-1 truncate text-sm text-slate-600">{list.map((e) => e.name).join(" · ")}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm">
                    {(phBy.get(c.id) ?? []).slice(0, 3).map((p) => (
                      <div key={p.number} className={p.quality === "ok" ? "" : "text-slate-400 line-through"}>{p.number}</div>
                    ))}
                  </div>
                </div>
                <div className="w-48 text-right text-xs text-slate-500">
                  <StatusBadge status={c.status} label={label(COMPANY_STATUSES, c.status, lang)} />
                  <div className="mt-1">{t.attempts}: {c.attempts}</div>
                  {c.lastCode && <div className="truncate">{codeLabel(c.lastCode, lang)}</div>}
                  {c.nextActionAt && <div>{t.nextAction}: {fmtDateTime(c.nextActionAt, lang)}</div>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
