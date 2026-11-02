import Link from "next/link";
import { FilterChips } from "@/components/FilterChips";
import { MultiSelect } from "@/components/MultiSelect";
import { Overlay } from "@/components/Overlay";
import { NewCaseForm } from "@/components/qr/NewCaseForm";
import { Empty } from "@/components/ui";
import { fmtDate } from "@/lib/dates";
import { getDict } from "@/lib/i18n-server";
import { caseCounters, deadlineOf, handlers, listCases, qrSettings, QR_CHANNELS, QR_MANUAL_CHANNELS, QR_PRIORITIES, QR_STATUSES, QR_TYPES, type CaseFilters } from "@/lib/qr";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/auth";
import { QR_CHANNEL_TEXT, QR_CHANNEL_TONE, QR_PRIORITY_TEXT, QR_STATUS_TEXT, QR_STATUS_TONE, QR_TEXT, QR_TYPE_TEXT } from "@/lib/qr-i18n";
import { createCaseAction, lookupRutAction } from "./actions";

const DOT = { ok: "bg-emerald-500", warn: "bg-amber-500", late: "bg-mitur-red", closed: "bg-emerald-500" };

// «Casos»: counters, one row of filters and the list, as in the approved preview.
export default async function CasesPage({ searchParams }: { searchParams: Promise<CaseFilters & Record<string, string | undefined>> }) {
  const u = await requireUser("q.register");
  const raw = await searchParams;
  const { t: common, lang } = await getDict();
  const t = QR_TEXT[lang];
  // With no filters at all the list opens on the open cases.
  const sp: CaseFilters & Record<string, string | undefined> = Object.values(raw).some(Boolean) ? raw : { status: "open" };
  const [rows, counters, s, people] = await Promise.all([listCases(u, sp), caseCounters(u), qrSettings(), handlers()]);
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  const manager = can(u, "q.seeAll");
  const groups = [
    { key: "status", label: t.fStatus, options: [["open", t.cOpen], ["late", t.cLate], ["unassigned", t.cUnassigned], ["mine", t.cMine], ...QR_STATUSES.map((x) => [x, QR_STATUS_TEXT[lang][x]])].map(([value, label]) => ({ value, label })) },
    { key: "type", label: t.fType, options: QR_TYPES.map((x) => ({ value: x, label: QR_TYPE_TEXT[lang][x] })) },
    { key: "channel", label: t.fChannel, options: QR_CHANNELS.map((x) => ({ value: x, label: QR_CHANNEL_TEXT[lang][x] })) },
  ];
  const tiles: [string, number, string][] = [
    ["open", counters.open, t.cOpen], ["late", counters.late, t.cLate], ["unassigned", counters.unassigned, t.cUnassigned],
    ["porcerrar", counters.toApprove, t.cToApprove], ["mine", counters.mine, t.cMine],
  ];

  return (
    <div className="space-y-5">
      <div className="page-title">
        <div>
          <h1>{t.module}</h1>
          <p className="subtitle">{manager ? t.listSubAll : t.listSubOwn}</p>
        </div>
        <Overlay width="max-w-3xl" trigger={t.newCase} title={t.ncTitle}>
          <NewCaseForm
            t={t}
            types={QR_TYPES.map((x) => ({ value: x, label: QR_TYPE_TEXT[lang][x] }))}
            topics={s.topics}
            channels={QR_MANUAL_CHANNELS.map((x) => ({ value: x, label: QR_CHANNEL_TEXT[lang][x] }))}
            priorities={QR_PRIORITIES.map((x) => ({ value: x, label: QR_PRIORITY_TEXT[lang][x] }))}
            handlers={people.map((p) => ({ value: String(p.id), label: p.name }))}
            canAssign={can(u, "q.assign")}
            cancelLabel={common.cancel}
            action={createCaseAction}
            lookup={lookupRutAction}
          />
        </Overlay>
      </div>

      {manager && (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5" data-testid="qr-counters">
          {tiles.map(([k, n, l]) => (
            <Link key={k} href={`/quejas?status=${k}`} className="card p-4 transition hover:border-brand-300">
              <div className={`text-2xl font-bold tabular-nums ${k === "late" && n ? "text-mitur-red" : "text-slate-900"}`}>{n}</div>
              <div className="text-xs font-semibold text-slate-500">{l}</div>
            </Link>
          ))}
        </div>
      )}

      <form className="flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={sp.q} className="input min-w-[14rem] flex-1" placeholder={t.searchPh} aria-label={t.fSearch} />
        {groups.map((g) => (
          <MultiSelect key={`${g.key}-${sp[g.key] ?? ""}`} name={g.key} value={sp[g.key]} options={g.options} t={common} allLabel={`${g.label}: ${common.all}`} className="w-48" />
        ))}
        <button className="btn-secondary">{common.filter}</button>
      </form>
      <FilterChips path="/quejas" sp={sp} groups={groups} keep={["q"]} t={common} />

      {rows.length === 0 ? (
        <Empty>{t.noCases}</Empty>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="table" data-testid="qr-cases">
              <thead><tr><th>{t.colCase}</th><th>{t.colSubject}</th><th>{t.colParty}</th><th>{t.fType}</th><th>{t.fChannel}</th><th>{t.fStatus}</th><th>{t.colDue}</th><th>{t.fAssigned}</th></tr></thead>
              <tbody>
                {rows.map((c) => {
                  const d = deadlineOf(c, s.warnDays);
                  return (
                    // The whole row opens the case (the link in the first cell covers it).
                    <tr key={c.id} className="relative cursor-pointer">
                      <td className="whitespace-nowrap">
                        <Link href={`/quejas/${c.number}`} className="font-semibold tabular-nums text-slate-900 after:absolute after:inset-0 hover:text-brand-700">{c.number}</Link>
                        <div className="text-xs text-slate-500">{fmtDate(c.createdAt, lang)}</div>
                      </td>
                      <td className="min-w-[11rem]">
                        <div className="text-slate-900">{c.subject}</div>
                        <div className="text-xs text-slate-500">{c.topic ?? ""}{c.priority === "Alta" && <span className="font-semibold text-mitur-red">{c.topic ? " · " : ""}{t.highPriority}</span>}</div>
                      </td>
                      <td className="min-w-[8rem]">
                        {c.partySigtur ? <span className="badge bg-violet-50 text-violet-700">{c.partyRut ?? c.partySigturId}</span> : <span className="badge bg-slate-100 text-slate-600">{t.noRut}</span>}
                        <div className="text-xs text-slate-500">{c.partyName}</div>
                      </td>
                      <td className="whitespace-nowrap text-sm">{QR_TYPE_TEXT[lang][c.type] ?? c.type}</td>
                      <td><span className={`badge whitespace-nowrap ${QR_CHANNEL_TONE[c.channel] ?? "bg-brand-50 text-brand-700"}`}>{QR_CHANNEL_TEXT[lang][c.channel] ?? c.channel}</span></td>
                      <td><span className={`badge whitespace-nowrap ${QR_STATUS_TONE[c.status]}`}>{QR_STATUS_TEXT[lang][c.status]}</span></td>
                      <td className="whitespace-nowrap text-sm">
                        <span className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${DOT[d.tone]}`} aria-hidden />
                          {d.tone === "closed" ? t.closedOn.replace("{d}", fmtDate(c.closedAt, lang)) : d.left < 0 ? t.daysLate.replace("{n}", String(-d.left)) : t.daysLeft.replace("{n}", String(d.left))}
                        </span>
                      </td>
                      <td className="whitespace-nowrap text-sm">{c.assignedUserId ? nameOf.get(c.assignedUserId) ?? "—" : <span className="text-slate-400">{t.none}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
