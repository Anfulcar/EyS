import type { Dict } from "@/lib/i18n";

type Person = { id: number; name: string; load: number; absent: boolean; agent: boolean };

// "To one person" or "shared evenly among…" (used to move or cover someone's tasks).
export function ReceiversFields({ people, t, exclude }: { people: Person[]; t: Dict; exclude: number }) {
  const others = people.filter((p) => p.id !== exclude);
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="choice">
          <input type="radio" name="mode" value="even" defaultChecked className="accent-brand-600" />
          <span>{t.shareEvenly}</span>
        </label>
        <div className="grid gap-2 pl-2 sm:grid-cols-2">
          {others.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="people" value={p.id} defaultChecked={p.agent && !p.absent} className="h-4 w-4 accent-brand-600" />
              <span className="min-w-0 flex-1">{p.name} <span className="text-xs text-slate-500">· {t.openLoad.replace("{n}", String(p.load))}</span></span>
              {p.absent && <span className="badge bg-amber-100 text-amber-800">{t.absentTag}</span>}
            </label>
          ))}
        </div>
        <label className="flex items-start gap-2 pl-2 text-sm text-slate-700">
          <input type="checkbox" name="workload" defaultChecked className="mt-0.5 h-4 w-4 accent-brand-600" />
          <span>{t.considerWorkload}</span>
        </label>
      </div>
      <div className="space-y-2">
        <label className="choice">
          <input type="radio" name="mode" value="one" className="accent-brand-600" />
          <span>{t.toOnePerson}</span>
        </label>
        <select name="toUserId" className="input" aria-label={t.toOnePerson} defaultValue="">
          <option value="">—</option>
          {others.map((p) => <option key={p.id} value={p.id}>{p.name}{p.absent ? ` (${t.absentTag})` : ""}</option>)}
        </select>
      </div>
    </div>
  );
}
