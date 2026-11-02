import Link from "next/link";
import { FilterChips } from "@/components/FilterChips";
import { MultiSelect } from "@/components/MultiSelect";
import { Overlay } from "@/components/Overlay";
import { NewCaseForm } from "@/components/qr/NewCaseForm";
import { QrTabs } from "@/components/qr/QrTabs";
import { Empty } from "@/components/ui";
import { fmtDate } from "@/lib/dates";
import { getDict } from "@/lib/i18n-server";
import { atLeast, caseCounters, deadlineOf, handlers, listCases, qrSettings, QR_CHANNELS, QR_MANUAL_CHANNELS, QR_PRIORITIES, QR_STATUSES, QR_TYPES, type CaseFilters } from "@/lib/qr";
import { requireQr } from "@/lib/qr-auth";
import { QR_CHANNEL_TEXT, QR_PRIORITY_TEXT, QR_STATUS_TEXT, QR_STATUS_TONE, QR_TEXT, QR_TYPE_TEXT } from "@/lib/qr-i18n";
import { createCaseAction, lookupRutAction } from "./actions";

const DOT = { ok: "bg-emerald-500", warn: "bg-amber-500", late: "bg-mitur-red", closed: "bg-emerald-500" };

export default async function CasesPage({ searchParams }: { searchParams: Promise<CaseFilters & Record<string, string | undefined>> }) {
  const u = await requireQr("register");
  const raw = await searchParams;
  const { t: common, lang } = await getDict();
  const t = QR_TEXT[lang];
  // With no filters at all the list opens on the open cases.
  const sp: CaseFilters & Record<string, string | undefined> = Object.values(raw).some(Boolean) ? raw : { status: "open" };
  const [rows, counters, s, people] = await Promise.all([listCases(u, sp), caseCounters(u), qrSettings(), handlers()]);
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  const manager = atLeast(u, "manage");
  const groups = [
    { key: "status", label: t.fStatus, options: [["open", t.cOpen], ["late", t.cLate], ["soon", t.cSoon], ["unassigned", t.cUnassigned], ...QR_STATUSES.map((x) => [x, QR_STATUS_TEXT[lang][x]])].map(([value, label]) => ({ value, label })) },
    { key: "type", label: t.fType, options: QR_TYPES.map((x) => ({ value: x, label: QR_TYPE_TEXT[lang][x] })) },
    { key: "channel", label: t.fChannel, options: QR_CHANNELS.map((x) => ({ value: x, label: QR_CHANNEL_TEXT[lang][x] })) },
    { key: "topic", label: t.fTopic, options: s.topics.map((x) => ({ value: x, label: x })) },
    ...(manager ? [{ key: "assigned", label: t.fAssigned, options: [{ value: "me", label: t.me }, { value: "none", label: t.none }, ...people.map((p) => ({ value: String(p.id), label: p.name }))] }] : []),
  ];
  const tiles = [
    ["open", counters.open, t.cOpen], ["late", counters.late, t.cLate], ["soon", counters.soon, t.cSoon],
    ...(manager ? [["unassigned", counters.unassigned, t.cUnassigned], ["porcerrar", counters.toApprove, t.cToApprove]] : []),
    ...(manager ? [["mine", counters.mine, t.cMine]] : []),
  ] as [string, number, string][];

  return (
    <div className="space-y-5">
      <div className="page-title">
        <div>
          <h1>{t.module}</h1>
          <p className="subtitle">{manager ? t.listSubAll : t.listSubOwn}</p>
        </div>
        <Overlay variant="drawer" width="max-w-3xl" trigger={t.newCase} title={t.ncTitle}>
          <NewCaseForm
            t={t}
            types={QR_TYPES.map((x) => ({ value: x, label: QR_TYPE_TEXT[lang][x] }))}
            topics={s.topics}
            channels={QR_MANUAL_CHANNELS.map((x) => ({ value: x, label: QR_CHANNEL_TEXT[lang][x] }))}
            priorities={QR_PRIORITIES.map((x) => ({ value: x, label: QR_PRIORITY_TEXT[lang][x] }))}
            handlers={people.map((p) => ({ value: String(p.id), label: p.name }))}
            canAssign={atLeast(u, "supervise")}
            action={createCaseAction}
            lookup={lookupRutAction}
          />
        </Overlay>
      </div>
      <QrTabs t={t} u={u} />

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6" data-testid="qr-counters">
        {tiles.map(([k, n, l]) => (
          <Link key={k} href={k === "mine" ? "/quejas?status=open&assigned=me" : `/quejas?status=${k}`} className="card p-4 transition hover:border-brand-200">
            <div className={`text-2xl font-bold tabular-nums ${k === "late" && n ? "text-mitur-red" : "text-slate-900"}`}>{n}</div>
            <div className="text-xs font-medium text-slate-500">{l}</div>
          </Link>
        ))}
      </div>

      <form className="card grid items-end gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <div className="sm:col-span-2 xl:col-span-2"><label className="label" htmlFor="q-q">{t.fSearch}</label><input id="q-q" name="q" defaultValue={sp.q} className="input" placeholder={t.searchPh} /></div>
        {groups.map((g) => (
          <div key={g.key}>
            <label className="label" htmlFor={`q-${g.key}`}>{g.label}</label>
            <MultiSelect key={sp[g.key] ?? ""} id={`q-${g.key}`} name={g.key} value={sp[g.key]} options={g.options} t={common} />
          </div>
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
              <thead><tr><th>{t.colCase}</th><th>{t.colSubject}</th><th>{t.colParty}</th><th>{t.fChannel}</th><th>{t.fStatus}</th><th>{t.colDue}</th>{manager && <th>{t.fAssigned}</th>}</tr></thead>
              <tbody>
                {rows.map((c) => {
                  const d = deadlineOf(c, s.warnDays);
                  return (
                    <tr key={c.id}>
                      <td className="whitespace-nowrap"><Link href={`/quejas/${c.number}`} className="font-semibold text-brand-700 hover:underline">{c.number}</Link><div className="text-xs text-slate-500">{fmtDate(c.createdAt, lang)}</div></td>
                      <td className="min-w-[12rem]">
                        <Link href={`/quejas/${c.number}`} className="text-slate-900 hover:text-brand-700">{c.subject}</Link>
                        <div className="text-xs text-slate-500">{[QR_TYPE_TEXT[lang][c.type] ?? c.type, c.topic].filter(Boolean).join(" · ")}{c.priority === "Alta" && <span className="ml-1 font-semibold text-mitur-red">· {t.highPriority}</span>}</div>
                      </td>
                      <td className="min-w-[10rem]">
                        {c.partySigtur ? <span className="badge bg-violet-50 text-violet-700">{c.partyRut ?? c.partySigturId}</span> : <span className="badge bg-slate-100 text-slate-600">{t.noRut}</span>}
                        <div className="text-xs text-slate-500">{c.partyName}</div>
                      </td>
                      <td className="text-sm">{QR_CHANNEL_TEXT[lang][c.channel] ?? c.channel}</td>
                      <td className="whitespace-nowrap"><span className={`badge ${QR_STATUS_TONE[c.status]}`}>{QR_STATUS_TEXT[lang][c.status]}</span></td>
                      <td className="whitespace-nowrap text-sm">
                        <span className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${DOT[d.tone]}`} aria-hidden />
                          {d.tone === "closed" ? t.closedOn.replace("{d}", fmtDate(c.closedAt, lang)) : d.left < 0 ? t.daysLate.replace("{n}", String(-d.left)) : t.daysLeft.replace("{n}", String(d.left))}
                        </span>
                      </td>
                      {manager && <td className="whitespace-nowrap text-sm">{c.assignedUserId ? nameOf.get(c.assignedUserId) ?? "—" : <span className="text-slate-400">{t.none}</span>}</td>}
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
