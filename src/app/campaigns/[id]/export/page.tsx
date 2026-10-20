import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { ExportChooser } from "@/components/ExportChooser";
import { db } from "@/db";
import { establishments, users } from "@/db/schema";
import { CALL_CODES, COMPANY_STATUSES, VISIT_CODES } from "@/lib/catalog";
import { getDict } from "@/lib/i18n-server";

export default async function ExportPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { t, lang } = await getDict();
  const [agents, zones, priorities] = await Promise.all([
    db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.role, ["agent", "supervisor", "admin"])).orderBy(asc(users.name)),
    db.selectDistinct({ v: establishments.zonaOperativa }).from(establishments).where(and(eq(establishments.campaignId, id), isNotNull(establishments.zonaOperativa))),
    db.selectDistinct({ v: establishments.prioridad }).from(establishments).where(and(eq(establishments.campaignId, id), isNotNull(establishments.prioridad))),
  ]);
  const opts = (rows: { v: string | null }[]) => rows.map((r) => r.v!).filter(Boolean).sort().map((v) => ({ value: v, label: v }));
  return (
    <div className="space-y-4">
      <div>
        <h2>{t.exportChoose}</h2>
        <p className="text-sm text-slate-600">{t.exportChooseHelp}</p>
      </div>
      <ExportChooser
        action={`/api/campaigns/${id}/export`}
        t={t}
        agents={[{ value: "none", label: t.unassigned }, ...agents.map((a) => ({ value: String(a.id), label: a.name }))]}
        zones={opts(zones)}
        priorities={opts(priorities)}
        codes={Object.entries({ ...CALL_CODES, ...VISIT_CODES }).map(([k, v]) => ({ value: k, label: v[lang] }))}
        statuses={Object.entries(COMPANY_STATUSES).map(([k, v]) => ({ value: k, label: v[lang] }))}
      />
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2>{t.exportCalls}</h2>
          <p className="text-sm text-slate-600">CSV (UTF-8)</p>
        </div>
        <a className="btn-secondary" href={`/api/campaigns/${id}/calls`}>⬇ {t.download}</a>
      </div>
    </div>
  );
}
