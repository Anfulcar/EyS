import { CampaignTabs } from "@/app/campaigns/[id]/tabs";
import type { Dict } from "@/lib/i18n";

// «Administración general»: the pages that apply to the whole app, one tab each (only the ones the profile allows).
export function AdminTabs({ t, me }: { t: Dict; me: { actions: readonly string[] } }) {
  const tabs = [
    { href: "/users", label: t.adminTabPeople, need: "g.people" },
    { href: "/admin/permissions", label: t.adminTabPermissions, need: "g.perms" },
    { href: "/integrations", label: t.adminTabSigtur, need: "g.sigtur" },
    { href: "/logs", label: t.adminTabLog, need: "g.log" },
  ].filter((x) => me.actions.includes(x.need));
  return (
    <div className="space-y-4">
      <div>
        <h1>{t.navAdmin}</h1>
        <p className="subtitle">{t.adminSubtitle}</p>
      </div>
      <CampaignTabs base="" tabs={tabs} />
    </div>
  );
}
