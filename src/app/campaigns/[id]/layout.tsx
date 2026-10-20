import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/ui";
import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { fmtDate } from "@/lib/dates";
import type { Dict } from "@/lib/i18n";
import { getDict } from "@/lib/i18n-server";
import { CampaignTabs } from "./tabs";

export default async function CampaignLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  await requireUser(["admin", "supervisor"]);
  const { id } = await params;
  const c = await db.query.campaigns.findFirst({ where: eq(campaigns.id, Number(id)) });
  if (!c) notFound();
  const { t, lang } = await getDict();
  const tabs = [
    { href: "", label: t.tabDashboard },
    { href: "/companies", label: t.tabCompanies },
    { href: "/import", label: t.tabImport },
    { href: "/email", label: t.tabEmail },
    { href: "/status", label: t.tabStatus },
    { href: "/export", label: t.tabExport },
    { href: "/settings", label: t.tabSettings },
  ];
  return (
    <div className="space-y-5">
      <div>
        <Link href="/campaigns" className="text-sm text-slate-500 hover:text-slate-800">← {t.navCampaigns}</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1>{c.name}</h1>
          <StatusBadge status={c.status} label={t[`campaignStatus_${c.status}` as keyof Dict]} />
          <span className="text-sm text-slate-500">{fmtDate(c.startDate, lang)} – {fmtDate(c.endDate, lang)}</span>
        </div>
        {c.description && <p className="mt-1 max-w-3xl text-sm text-slate-600">{c.description}</p>}
      </div>
      <CampaignTabs base={`/campaigns/${c.id}`} tabs={tabs} />
      {children}
    </div>
  );
}
