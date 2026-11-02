import { CampaignTabs } from "@/app/campaigns/[id]/tabs";
import type { User } from "@/db/schema";
import { atLeast } from "@/lib/qr";
import type { QrDict } from "@/lib/qr-i18n";

// The module's own sub-menu: cases, statistics (handlers and supervisors), settings (supervisors).
export function QrTabs({ t, u }: { t: QrDict; u: User }) {
  const tabs = [
    { href: "/quejas", label: t.tabCases },
    ...(atLeast(u, "manage") ? [{ href: "/quejas/estadisticas", label: t.tabStats }] : []),
    ...(atLeast(u, "supervise") ? [{ href: "/quejas/configuracion", label: t.tabSettings }] : []),
  ];
  return tabs.length > 1 ? <CampaignTabs base="" tabs={tabs} /> : null;
}
