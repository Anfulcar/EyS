import { desc, inArray, sql } from "drizzle-orm";
import { CalendarDays, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { CampaignFields } from "@/components/CampaignFields";
import { Overlay } from "@/components/Overlay";
import { SigturPermanentCard } from "@/components/SigturPermanentCard";
import { Empty, StatusBadge } from "@/components/ui";
import { db } from "@/db";
import { campaigns, companies, establishments } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { fmtDate } from "@/lib/dates";
import type { Dict } from "@/lib/i18n";
import { getDict } from "@/lib/i18n-server";
import { requestsOverview } from "@/lib/sigtur";
import { createCampaignAction } from "../actions";

export default async function CampaignsPage() {
  const me = await requireUser(["admin", "supervisor"]);
  const { t, lang } = await getDict();
  // The permanent SIGTUR campaign has its own block; the grid shows only temporary campaigns.
  const [all, permanent] = await Promise.all([db.select().from(campaigns).orderBy(desc(campaigns.startDate)), requestsOverview()]);
  const list = all.filter((c) => c.kind !== "sigtur_requests");
  const ids = list.length ? list.map((c) => c.id) : [-1];
  // Counts per campaign (grouped queries, so each card shows its own totals).
  const [taskRows, estRows] = await Promise.all([
    db
      .select({ id: companies.campaignId, n: sql<number>`count(*)`, done: sql<number>`sum(case when ${companies.status} in ('done','visit','transferred') then 1 else 0 end)` })
      .from(companies)
      .where(inArray(companies.campaignId, ids))
      .groupBy(companies.campaignId),
    db
      .select({ id: establishments.campaignId, n: sql<number>`count(*)`, sent: sql<number>`sum(case when ${establishments.correoEnviadoFecha} is not null then 1 else 0 end)` })
      .from(establishments)
      .where(inArray(establishments.campaignId, ids))
      .groupBy(establishments.campaignId),
  ]);
  const tasks = new Map(taskRows.map((r) => [r.id, r]));
  const ests = new Map(estRows.map((r) => [r.id, r.n]));
  const sentBy = new Map(estRows.map((r) => [r.id, Number(r.sent ?? 0)]));

  return (
    <div className="space-y-6">
      <div className="page-title">
        <h1>{t.navCampaigns}</h1>
        {me.role === "admin" && (
          <Overlay trigger={<><Plus className="h-4 w-4" />{t.newCampaign}</>} title={t.newCampaign}>
            <ActionForm action={createCampaignAction} className="space-y-5">
              <CampaignFields t={t} />
              <div className="flex justify-end"><SubmitButton>{t.create}</SubmitButton></div>
            </ActionForm>
          </Overlay>
        )}
      </div>
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t.sigturPermanent}</h2>
        <SigturPermanentCard o={permanent} t={t} lang={lang} isAdmin={me.role === "admin"} />
      </section>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t.sigturTemporary}</h2>
      {list.length === 0 ? (
        <Empty>{t.noCampaigns}</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => {
            const n = tasks.get(c.id)?.n ?? 0;
            const done = tasks.get(c.id)?.done ?? 0;
            // An email campaign's progress is the share of establishments already sent.
            const isEmail = c.kind === "email";
            const nEst = Number(ests.get(c.id) ?? 0);
            const pctDone = isEmail ? (nEst ? Math.round(((sentBy.get(c.id) ?? 0) / nEst) * 100) : 0) : n ? Math.round((done / n) * 100) : 0;
            return (
              <Link key={c.id} href={`/campaigns/${c.id}`} className="card group flex flex-col gap-4 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="leading-snug">{c.name}</h2>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                    {isEmail && <span className="badge bg-violet-50 text-violet-700">{t.emailCampaignTag}</span>}
                    <StatusBadge status={c.status} label={t[`campaignStatus_${c.status}` as keyof Dict]} />
                  </div>
                </div>
                <p className="-mt-2 flex items-center gap-1.5 text-sm text-slate-500"><CalendarDays className="h-4 w-4" />{fmtDate(c.startDate, lang)} – {fmtDate(c.endDate, lang)}</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="text-lg font-bold tabular-nums text-slate-900">{n}</div><div className="text-xs text-slate-500">{t.companies}</div></div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="text-lg font-bold tabular-nums text-slate-900">{ests.get(c.id) ?? 0}</div><div className="text-xs text-slate-500">{t.establishments}</div></div>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs text-slate-500"><span>{isEmail ? t.emailCampaignSent : t.finished}</span><span className="font-medium text-slate-700">{pctDone} %</span></div>
                  <div className="h-1.5 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-brand-600" style={{ width: `${pctDone}%` }} /></div>
                </div>
                <span className="mt-auto flex items-center justify-end gap-1 text-sm font-medium text-brand-600 opacity-0 transition group-hover:opacity-100">{lang === "es" ? "Abrir" : "Open"} <ChevronRight className="h-4 w-4" /></span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
