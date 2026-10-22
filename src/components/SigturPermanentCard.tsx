import { ChevronRight, Send } from "lucide-react";
import Link from "next/link";
import { setSigturRequestsAction } from "@/app/actions";
import type { Lang } from "@/lib/catalog";
import { fmtDateTime } from "@/lib/dates";
import type { Dict } from "@/lib/i18n";
import type { requestsOverview } from "@/lib/sigtur";
import { ActionForm, ConfirmButton } from "./ActionForm";

type Overview = Awaited<ReturnType<typeof requestsOverview>>;

// On/off switch of the permanent «Solicitudes SIGTUR» campaign (administrators only; the server checks it too).
export function SigturSwitch({ paused, t }: { paused: boolean; t: Dict }) {
  const track = (on: boolean) => (
    <span className={`relative inline-block h-6 w-11 rounded-full transition ${on ? "bg-emerald-500" : "bg-slate-300"}`}>
      <span className={`absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow ${on ? "right-[3px]" : "left-[3px]"}`} />
    </span>
  );
  return (
    <ActionForm action={setSigturRequestsAction}>
      <input type="hidden" name="on" value={paused ? "1" : "0"} />
      {paused ? (
        <button className="flex items-center gap-2 text-sm font-medium text-slate-700">
          {track(false)}{t.sigturOff}
        </button>
      ) : (
        <ConfirmButton message={t.sigturSwitchOffConfirm} className="flex items-center gap-2 text-sm font-medium text-slate-700">
          {track(true)}{t.sigturOn}
        </ConfirmButton>
      )}
    </ActionForm>
  );
}

export function SigturStatusBadge({ paused, t }: { paused: boolean; t: Dict }) {
  return paused ? (
    <span className="badge bg-amber-100 text-amber-800">⏸ {t.sigturPausedBadge}</span>
  ) : (
    <span className="badge bg-emerald-50 text-emerald-700">● {t.sigturReceiving}</span>
  );
}

export function SigturPermanentCard({ o, t, lang, isAdmin }: { o: Overview; t: Dict; lang: Lang; isAdmin: boolean }) {
  const paused = o.campaign.requestsPaused;
  const stat = (n: number, l: string) => (
    <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="text-lg font-bold tabular-nums text-slate-900">{n}</div><div className="text-xs text-slate-500">{l}</div></div>
  );
  return (
    <div className={`card flex flex-wrap items-center gap-6 ${paused ? "border-slate-300 bg-slate-50/70" : "border-purple-200 ring-1 ring-purple-100"}`} data-testid="sigtur-permanent">
      <div className="min-w-[16rem] flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Send className="h-4 w-4 text-purple-600" />
          <h2 className="leading-snug">{o.campaign.name}</h2>
          <SigturStatusBadge paused={paused} t={t} />
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {paused && o.campaign.pausedAt
            ? t.sigturPausedBy.replace("{name}", o.pausedByName ?? "—").replace("{date}", fmtDateTime(o.campaign.pausedAt, lang))
            : t.sigturPermanentHelp}
        </p>
        <p className="mt-0.5 text-sm text-slate-500">{o.assignees.length ? t.sigturAssignedTo.replace("{names}", o.assignees.join(", ")) : t.sigturNoAssignees}</p>
        {!isAdmin && <p className="mt-0.5 text-xs text-slate-400">{t.sigturOnlyAdmin}</p>}
      </div>
      <div className="grid grid-cols-3 gap-3 text-sm">
        {stat(o.open, t.sigturOpenCount)}
        {stat(o.today, t.sigturTodayCount)}
        {stat(o.done, t.sigturDoneCount)}
      </div>
      <div className="flex flex-col items-end gap-2">
        {isAdmin && <SigturSwitch paused={paused} t={t} />}
        <Link href={`/campaigns/${o.campaign.id}/companies`} className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">{t.sigturSeeTasks}<ChevronRight className="h-4 w-4" /></Link>
      </div>
    </div>
  );
}
