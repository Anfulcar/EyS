import { eq } from "drizzle-orm";
import { BookOpen, Table2 } from "lucide-react";
import { SectionTitle } from "@/components/ui";
import { db } from "@/db";
import { campaigns, establishments } from "@/db/schema";
import { CALL_CODES, CHANNELS, COMPANY_STATUSES, SIGTUR_STATUSES, VISIT_CODES } from "@/lib/catalog";
import { getDict } from "@/lib/i18n-server";
import { CALL_HELP, CHANNEL_HELP, PRIORITY_HELP, SIGTUR_HELP, STATUS_HELP, VISIT_HELP } from "@/lib/legend";

type Est = typeof establishments.$inferSelect;

export default async function SummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const [{ t, lang }, c, ests] = await Promise.all([
    getDict(),
    db.query.campaigns.findFirst({ where: eq(campaigns.id, id) }),
    db.select().from(establishments).where(eq(establishments.campaignId, id)),
  ]);
  // Establishments of companies with 2+ establishments (same RNC) in this campaign.
  const rncKey = (e: Est) => (e.rnc ?? "").replace(/[^0-9A-Za-z]/g, "");
  const perRnc = new Map<string, number>();
  for (const e of ests) if (rncKey(e).length >= 5) perRnc.set(rncKey(e), (perRnc.get(rncKey(e)) ?? 0) + 1);
  const yes = (v: string | null) => v === "Sí";
  const zones = [...new Set(ests.map((e) => e.zonaOperativa ?? "—"))].sort();
  const rows: [string, (e: Est) => boolean][] = [
    [t.sumUniverse, () => true],
    [t.sumEmail, (e) => yes(e.correoValido)],
    [t.sumPhone, (e) => yes(e.telefonoValido)],
    [t.sumNoContact, (e) => !yes(e.correoValido) && !yes(e.telefonoValido)],
    ...(["P1", "P2", "P3"] as const).map((p) => [`${t.priority} ${p}`, (e: Est) => e.prioridad === p] as [string, (e: Est) => boolean]),
    [t.sumMulti, (e) => (perRnc.get(rncKey(e)) ?? 0) >= 2],
    ...zones.map((z) => [`${t.zone} ${z}`, (e: Est) => (e.zonaOperativa ?? "—") === z] as [string, (e: Est) => boolean]),
    [t.sumOver5, (e) => (e.antiguedad ?? "").startsWith("5.")],
  ];
  const venc = ests.filter((e) => e.estatusRnt === "Vencida");
  const sinLic = ests.filter((e) => e.estatusRnt === "Sin licencia");
  const days = String(c?.followupDays ?? 5);
  const Legend = ({ title, items }: { title: string; items: [string, string, string?][] }) => (
    <div className="card">
      <h2 className="mb-3 text-base">{title}</h2>
      <dl className="space-y-2.5">
        {items.map(([k, v, help]) => (
          <div key={k} className="text-sm">
            <dt className="font-medium text-slate-900">{v}</dt>
            {help && <dd className="text-slate-600">{help}</dd>}
          </div>
        ))}
      </dl>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="card overflow-hidden p-0">
        <div className="px-5 pt-5"><SectionTitle icon={<Table2 className="h-4 w-4" />}>{t.sumTitle}</SectionTitle></div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>{t.sumIndicator}</th><th className="text-right">Vencidas</th><th className="text-right">Sin licencia</th><th className="text-right">Total</th></tr>
            </thead>
            <tbody>
              {rows.map(([name, fn]) => (
                <tr key={name}>
                  <td>{name}</td>
                  <td className="text-right tabular-nums">{venc.filter(fn).length}</td>
                  <td className="text-right tabular-nums">{sinLic.filter(fn).length}</td>
                  <td className="text-right font-semibold tabular-nums">{ests.filter(fn).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-2 text-slate-700"><BookOpen className="h-4 w-4 text-brand-600" /><h2 className="text-base">{t.sumLegend}</h2></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Legend title={t.sumPriorities} items={Object.entries(PRIORITY_HELP).map(([k, v]) => [k, k, v[lang]])} />
        <Legend title={t.sumTaskStatuses} items={Object.entries(COMPANY_STATUSES).map(([k, v]) => [k, v[lang], STATUS_HELP[k]?.[lang]])} />
        <Legend title={t.sumCallResults} items={Object.entries(CALL_CODES).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, v[lang], CALL_HELP[k]?.[lang].replace("{days}", days)])} />
        <div className="space-y-4">
          <Legend title={t.sumVisitResults} items={Object.entries(VISIT_CODES).map(([k, v]) => [k, v[lang], VISIT_HELP[k]?.[lang]])} />
          <Legend title={t.sumSigtur} items={SIGTUR_STATUSES.map((s) => [s, s, SIGTUR_HELP[s]?.[lang]])} />
          <Legend title={t.sumChannels} items={CHANNELS.map((s) => [s, s, CHANNEL_HELP[s]?.[lang]])} />
        </div>
      </div>
    </div>
  );
}
