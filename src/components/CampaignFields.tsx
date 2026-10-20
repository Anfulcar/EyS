import type { Campaign } from "@/db/schema";
import { todayLocal } from "@/lib/dates";
import type { Dict } from "@/lib/i18n";

export function CampaignFields({ t, values }: { t: Dict; values?: Partial<Campaign> }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="label">{t.campaignName}</label>
        <input name="name" className="input" required minLength={3} defaultValue={values?.name} placeholder="Formalización Región Este – Q4 2026" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label">{t.startDate}</label>
          <input name="startDate" type="date" className="input" required defaultValue={values?.startDate ?? todayLocal()} />
        </div>
        <div>
          <label className="label">{t.endDate}</label>
          <input name="endDate" type="date" className="input" required defaultValue={values?.endDate} />
        </div>
        <div>
          <label className="label">{t.maxAttempts}</label>
          <input name="maxAttempts" type="number" min={1} max={10} className="input" defaultValue={values?.maxAttempts ?? 3} />
          <p className="mt-1 text-xs text-slate-500">{t.maxAttemptsHelp}</p>
        </div>
        <div>
          <label className="label">{t.followupDays}</label>
          <input name="followupDays" type="number" min={1} max={30} className="input" defaultValue={values?.followupDays ?? 5} />
          <p className="mt-1 text-xs text-slate-500">{t.followupDaysHelp}</p>
        </div>
      </div>
      <div>
        <label className="label">{t.description}</label>
        <textarea name="description" className="input" rows={2} defaultValue={values?.description ?? ""} />
      </div>
    </div>
  );
}
