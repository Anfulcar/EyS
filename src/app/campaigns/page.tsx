import { desc, sql } from "drizzle-orm";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Empty, StatusBadge } from "@/components/ui";
import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { fmtDate } from "@/lib/dates";
import type { Dict } from "@/lib/i18n";
import { getDict } from "@/lib/i18n-server";
import { CampaignFields } from "@/components/CampaignFields";
import { createCampaignAction } from "../actions";

export default async function CampaignsPage() {
  const me = await requireUser(["admin", "supervisor"]);
  const { t, lang } = await getDict();
  const list = await db
    .select({
      c: campaigns,
      companies: sql<number>`(select count(*) from companies where campaign_id = ${campaigns.id})`,
      ests: sql<number>`(select count(*) from establishments where campaign_id = ${campaigns.id})`,
      done: sql<number>`(select count(*) from companies where campaign_id = ${campaigns.id} and status in ('done','visit'))`,
    })
    .from(campaigns)
    .orderBy(desc(campaigns.startDate));
  return (
    <div className="space-y-6">
      <h1>{t.navCampaigns}</h1>
      {list.length === 0 ? (
        <Empty>{t.noCampaigns}</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {list.map(({ c, companies, ests, done }) => (
            <Link key={c.id} href={`/campaigns/${c.id}`} className="card block transition hover:border-brand-500">
              <div className="flex items-start justify-between gap-2">
                <h2 className="leading-snug">{c.name}</h2>
                <StatusBadge status={c.status} label={t[`campaignStatus_${c.status}` as keyof Dict]} />
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {fmtDate(c.startDate, lang)} – {fmtDate(c.endDate, lang)}
              </p>
              <div className="mt-4 flex gap-6 text-sm">
                <div><div className="text-xl font-semibold tabular-nums">{companies}</div><div className="text-slate-500">{t.companies}</div></div>
                <div><div className="text-xl font-semibold tabular-nums">{ests}</div><div className="text-slate-500">{t.establishments}</div></div>
                <div><div className="text-xl font-semibold tabular-nums">{companies ? Math.round((done / companies) * 100) : 0} %</div><div className="text-slate-500">{t.finished}</div></div>
              </div>
            </Link>
          ))}
        </div>
      )}
      {me.role === "admin" && (
        <ActionForm action={createCampaignAction} className="card space-y-4">
          <h2>{t.newCampaign}</h2>
          <CampaignFields t={t} />
          <SubmitButton>{t.create}</SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}
