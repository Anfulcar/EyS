import { and, asc, eq, gt, inArray, isNull, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { AlertTriangle, Building2, ChevronRight, Clock, MessageCircle, Phone } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { RefreshButton } from "@/components/RefreshButton";
import { Empty, PriorityBadge, StatusBadge } from "@/components/ui";
import { db } from "@/db";
import { campaigns, companies, establishments, phones, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { codeLabel, COMPANY_STATUSES, label } from "@/lib/catalog";
import { fmtDateTime, nowIso, todayLocal } from "@/lib/dates";
import { getDict } from "@/lib/i18n-server";

const TABS = ["due", "scheduled", "visit", "done"] as const;
const PAGE = 100;
const rncKey = sql<string>`replace(replace(replace(coalesce(${companies.rnc}, ''), '-', ''), ' ', ''), '.', '')`;

export default async function CallsPage({ searchParams }: { searchParams: Promise<{ tab?: string; agent?: string; campaign?: string; limit?: string }> }) {
  const me = await requireUser(["agent", "admin", "supervisor"]);
  const sp = await searchParams;
  const { t, lang } = await getDict();
  const tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? sp.tab! : "due";
  const isManager = me.role !== "agent";
  const agentId = isManager && sp.agent ? Number(sp.agent) : me.id;
  const limit = Math.min(2000, Math.max(PAGE, Number(sp.limit) || PAGE));
  const today = todayLocal();
  const now = nowIso();

  // Every campaign that is not closed: draft or out-of-dates campaigns are shown with a warning instead of hidden.
  const open = await db.select().from(campaigns).where(ne(campaigns.status, "closed"));
  const warnings = open.filter((c) => c.status !== "active" || today < c.startDate || today > c.endDate);
  const campaignIds = open.map((c) => c.id).filter((id) => !sp.campaign || id === Number(sp.campaign));

  const base: SQL[] = [
    inArray(companies.campaignId, campaignIds.length ? campaignIds : [-1]),
    eq(companies.assignedUserId, agentId),
    sql`exists (select 1 from establishments e where e.company_id = ${companies.id})`,
  ];
  const filters: Record<string, SQL> = {
    due: and(inArray(companies.status, ["pending", "retry", "followup"]), or(isNull(companies.nextActionAt), lte(companies.nextActionAt, now)))!,
    scheduled: and(inArray(companies.status, ["retry", "followup"]), gt(companies.nextActionAt, now))!,
    visit: eq(companies.status, "visit"),
    done: eq(companies.status, "done"),
  };
  const rows = await db
    .select()
    .from(companies)
    .where(and(...base, filters[tab]))
    // Due first, then priority; tasks of the same company (RNC) stay next to each other.
    .orderBy(sql`case when ${companies.nextActionAt} is null then 1 else 0 end`, asc(companies.nextActionAt), asc(companies.priority), asc(rncKey), asc(companies.id))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const list = rows.slice(0, limit);
  const ids = list.map((r) => r.id);
  const [ests, phs, siblings] = ids.length
    ? await Promise.all([
        db.select({ companyId: establishments.companyId, name: establishments.nombreComercial, rut: establishments.rut, status: establishments.estatusRnt, municipio: establishments.municipio }).from(establishments).where(inArray(establishments.companyId, ids)),
        db.select({ companyId: phones.companyId, number: phones.number, quality: phones.quality }).from(phones).where(and(inArray(phones.companyId, ids), eq(phones.active, true))),
        db
          .select({ campaignId: companies.campaignId, k: rncKey, n: sql<number>`count(*)` })
          .from(companies)
          .where(inArray(companies.campaignId, campaignIds.length ? campaignIds : [-1]))
          .groupBy(companies.campaignId, rncKey),
      ])
    : [[], [], []];
  const estBy = new Map(ests.map((e) => [e.companyId, e]));
  const phBy = new Map<number, typeof phs>();
  for (const p of phs) phBy.set(p.companyId, [...(phBy.get(p.companyId) ?? []), p]);
  const sibCount = new Map(siblings.filter((s) => s.k.length >= 5).map((s) => [`${s.campaignId}|${s.k}`, s.n - 1]));
  const agents = isManager ? await db.select().from(users).where(eq(users.active, true)).orderBy(asc(users.name)) : [];
  const campaignName = new Map(open.map((c) => [c.id, c.name]));
  const qs = (o: Record<string, string>) => "?" + new URLSearchParams({ ...(sp as Record<string, string>), ...o }).toString();
  const tabLabels: Record<string, string> = { due: t.dueNow, scheduled: t.scheduled, visit: t.sentToVisit, done: t.finished };
  const viewing = agents.find((a) => a.id === agentId);

  return (
    <div className="space-y-6">
      <div className="page-title">
        <div>
          <h1>{t.hello}, {(viewing ?? me).name.split(" ")[0]} 👋</h1>
          <p className="subtitle">{t.queueSubtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(open.length > 1 || isManager) && (
            <form className="flex flex-wrap gap-2">
              <input type="hidden" name="tab" value={tab} />
              {open.length > 1 && (
                <select name="campaign" defaultValue={sp.campaign ?? ""} className="input w-56">
                  <option value="">{t.navCampaigns}: {t.all}</option>
                  {open.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
              {isManager && (
                <select name="agent" defaultValue={String(agentId)} className="input w-48">
                  {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              )}
              <button className="btn-secondary">{t.filter}</button>
            </form>
          )}
          <RefreshButton label={t.refresh} />
        </div>
      </div>

      {warnings.map((c) => (
        <p key={c.id} className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span><b>{c.name}</b>: {c.status === "draft" ? t.campaignDraftWarning : t.outsideDates}</span>
        </p>
      ))}

      <nav className="segmented">
        {TABS.map((k) => (
          <Link key={k} href={qs({ tab: k, limit: "" })} aria-current={tab === k ? "page" : undefined}>{tabLabels[k]}</Link>
        ))}
      </nav>

      {list.length === 0 ? (
        <Empty>{t.noCalls}</Empty>
      ) : (
        <div className="grid gap-3">
          {list.map((c) => {
            const e = estBy.get(c.id);
            const name = e?.name ?? c.razonSocial ?? c.key;
            const sib = sibCount.get(`${c.campaignId}|${(c.rnc ?? "").replace(/[-\s.]/g, "")}`) ?? 0;
            const nums = phBy.get(c.id) ?? [];
            return (
              <Link key={c.id} href={`/calls/${c.id}`} className="card group flex flex-wrap items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md">
                <Avatar name={name} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-base font-semibold text-slate-900">{name}</span>
                    <PriorityBadge p={c.priority} />
                    {c.whatsappSuggested && <span className="badge bg-green-50 text-green-700"><MessageCircle className="h-3 w-3" />WhatsApp</span>}
                  </div>
                  <div className="mt-0.5 truncate text-sm text-slate-500">
                    {c.razonSocial}{e?.municipio ? ` · ${e.municipio}` : ""}{open.length > 1 ? ` · ${campaignName.get(c.campaignId)}` : ""}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    {e?.status && <span className={`badge ${e.status === "Vencida" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>{e.status}</span>}
                    {sib > 0 && <span className="badge bg-brand-50 text-brand-700"><Building2 className="h-3 w-3" />+{sib} {t.ofSameCompany}</span>}
                    {nums.slice(0, 2).map((p) => (
                      <span key={p.number} className={`badge bg-slate-100 font-mono text-slate-700 ${p.quality === "ok" || p.quality === "invalid" ? "" : "line-through opacity-60"}`}>
                        <Phone className="h-3 w-3" />{p.number}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right text-xs text-slate-500">
                    <StatusBadge status={c.status} label={label(COMPANY_STATUSES, c.status, lang)} />
                    <div className="mt-1.5">{c.lastCode ? `${t.lastCall}: ${codeLabel(c.lastCode, lang)}` : t.noAnswerYet}</div>
                    {c.nextActionAt && <div className="mt-0.5 flex items-center justify-end gap-1"><Clock className="h-3 w-3" />{fmtDateTime(c.nextActionAt, lang)}</div>}
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-300 transition group-hover:text-brand-500" />
                </div>
              </Link>
            );
          })}
          {hasMore && (
            <Link href={qs({ limit: String(limit + PAGE) })} className="btn-secondary mx-auto">{lang === "es" ? "Ver más" : "Show more"}</Link>
          )}
        </div>
      )}
    </div>
  );
}
