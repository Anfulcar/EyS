import { CampaignTabs } from "@/app/campaigns/[id]/tabs";
import type { Dict } from "@/lib/i18n";

// «Administración general»: the pages that apply to the whole app, one tab each.
export function AdminTabs({ t }: { t: Dict }) {
  return (
    <div className="space-y-4">
      <div>
        <h1>{t.navAdmin}</h1>
        <p className="subtitle">{t.adminSubtitle}</p>
      </div>
      <CampaignTabs
        base=""
        tabs={[
          { href: "/users", label: t.adminTabPeople },
          { href: "/admin/permissions", label: t.adminTabPermissions },
          { href: "/integrations", label: t.adminTabSigtur },
          { href: "/logs", label: t.adminTabLog },
        ]}
      />
    </div>
  );
}
