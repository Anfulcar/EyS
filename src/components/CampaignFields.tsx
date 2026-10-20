import type { Campaign } from "@/db/schema";
import { todayLocal } from "@/lib/dates";
import type { Dict } from "@/lib/i18n";

export function CampaignFields({ t, values }: { t: Dict; values?: Partial<Campaign> }) {
  return (
    <div className="grid gap-4 md:grid-cols-6">
      <div className="md:col-span-3">
        <label className="label">{t.campaignName}</label>
        <input name="name" className="input" required minLength={3} defaultValue={values?.name} placeholder="Formalización Región Este – Q4 2026" />
      </div>
      <div>
        <label className="label">{t.startDate}</label>
        <input name="startDate" type="date" className="input" required defaultValue={values?.startDate ?? todayLocal()} />
      </div>
      <div>
        <label className="label">{t.endDate}</label>
        <input name="endDate" type="date" className="input" required defaultValue={values?.endDate} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">{t.maxAttempts}</label>
          <input name="maxAttempts" type="number" min={1} max={10} className="input" defaultValue={values?.maxAttempts ?? 3} />
        </div>
        <div>
          <label className="label">{t.followupDays}</label>
          <input name="followupDays" type="number" min={1} max={30} className="input" defaultValue={values?.followupDays ?? 5} />
        </div>
      </div>
      <div className="md:col-span-6">
        <label className="label">{t.description}</label>
        <textarea name="description" className="input" rows={2} defaultValue={values?.description ?? ""} />
      </div>
    </div>
  );
}
