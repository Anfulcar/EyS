import { and, asc, eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { KeyRound, PhoneIncoming, Plug, ScrollText, Users2 } from "lucide-react";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/ActionForm";
import { SigturStatusBadge, SigturSwitch } from "@/components/SigturPermanentCard";
import { Empty, SectionTitle } from "@/components/ui";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { fmtDateTime } from "@/lib/dates";
import { getDict } from "@/lib/i18n-server";
import { listKeys, recentIntegrationLog, requestsCampaign } from "@/lib/sigtur";
import { createApiKeyAction, revokeApiKeyAction, saveAutoAssigneesAction, simulateCallRequestAction } from "../actions";

export default async function IntegrationsPage() {
  await requireUser(["admin"]);
  const { t, lang } = await getDict();
  const [keys, log, campaign, staff] = await Promise.all([
    listKeys(),
    recentIntegrationLog(30),
    requestsCampaign(),
    db.select({ id: users.id, name: users.name, role: users.role }).from(users).where(and(eq(users.active, true), inArray(users.role, ["agent", "supervisor", "admin"]))).orderBy(asc(users.name)),
  ]);
  const chosen = new Set<number>(campaign.autoAssignees ? JSON.parse(campaign.autoAssignees) : []);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? ""}`;
  const KIND: Record<string, string> = { call_request: t.integrationKindCall, campaign: t.integrationKindCampaign, interactions: t.integrationKindInteractions };

  return (
    <div className="space-y-6">
      <div className="page-title">
        <div>
          <h1>{t.navIntegrations}</h1>
          <p className="subtitle">{t.integrationSubtitle}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card space-y-4">
          <SectionTitle icon={<KeyRound className="h-4 w-4" />}>{t.integrationKeys}</SectionTitle>
          <p className="text-sm text-slate-600">{t.integrationKeysHelp}</p>
          {keys.length === 0 ? (
            <p className="text-sm text-slate-500">{t.integrationNoKeys}</p>
          ) : (
            <ul className="space-y-2">
              {keys.map((k) => (
                <li key={k.id} className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${k.revokedAt ? "bg-slate-50 opacity-60" : "bg-slate-50"}`}>
                  <span className="flex-1">
                    <b>{k.name}</b> <span className="font-mono text-xs text-slate-500">{k.prefix}…</span>
                    <span className="block text-xs text-slate-500">
                      {k.revokedAt ? `${t.integrationRevoked} ${fmtDateTime(k.revokedAt, lang)}` : k.lastUsedAt ? `${t.integrationLastUsed} ${fmtDateTime(k.lastUsedAt, lang)}` : t.integrationNeverUsed}
                    </span>
                  </span>
                  {!k.revokedAt && (
                    <ActionForm action={revokeApiKeyAction}>
                      <input type="hidden" name="keyId" value={k.id} />
                      <ConfirmButton message={t.integrationRevokeConfirm} className="btn-secondary btn-sm">{t.integrationRevoke}</ConfirmButton>
                    </ActionForm>
                  )}
                </li>
              ))}
            </ul>
          )}
          <ActionForm action={createApiKeyAction} className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4">
            <div className="flex-1">
              <label className="label" htmlFor="key-name">{t.integrationKeyName}</label>
              <input id="key-name" name="name" className="input" defaultValue="SIGTUR" maxLength={60} />
            </div>
            <SubmitButton>{t.integrationCreateKey}</SubmitButton>
          </ActionForm>
          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
            <div className="mb-1 font-semibold text-slate-700">{t.integrationAddresses}</div>
            <div className="break-all font-mono">POST {origin}/api/integrations/sigtur/call-requests</div>
            <div className="break-all font-mono">POST {origin}/api/integrations/sigtur/campaigns</div>
            <div className="break-all font-mono">GET {origin}/api/integrations/sigtur/interactions</div>
            <div className="mt-1">{t.integrationDocHint}</div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card space-y-3">
            <SectionTitle icon={<PhoneIncoming className="h-4 w-4" />}>{t.sigturReceiveRequests}</SectionTitle>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
              <SigturStatusBadge paused={campaign.requestsPaused} t={t} />
              <SigturSwitch paused={campaign.requestsPaused} t={t} />
            </div>
            {campaign.requestsPaused && campaign.pausedAt && <p className="text-xs text-slate-500">{fmtDateTime(campaign.pausedAt, lang)}</p>}
          </div>

          <div className="card space-y-3">
            <SectionTitle icon={<Users2 className="h-4 w-4" />}>{t.integrationAssignees}</SectionTitle>
            <p className="text-sm text-slate-600">{t.integrationAssigneesHelp}</p>
            <ActionForm action={saveAutoAssigneesAction} className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                {staff.map((s) => (
                  <label key={s.id} className="choice">
                    <input type="checkbox" name="people" value={s.id} defaultChecked={chosen.has(s.id)} className="h-4 w-4 accent-brand-600" /> {s.name}
                  </label>
                ))}
              </div>
              <div className="flex justify-end"><SubmitButton className="btn-secondary">{t.save}</SubmitButton></div>
            </ActionForm>
          </div>

          <div className="card space-y-3">
            <SectionTitle icon={<PhoneIncoming className="h-4 w-4" />}>{t.integrationSimulate}</SectionTitle>
            <p className="text-sm text-slate-600">{t.integrationSimulateHelp}</p>
            <ActionForm action={simulateCallRequestAction} className="grid gap-3 sm:grid-cols-2" resetOnSuccess>
              <div><label className="label" htmlFor="sim-id">ID SIGTUR</label><input id="sim-id" name="idSigtur" className="input" required /></div>
              <div><label className="label" htmlFor="sim-name">{t.company}</label><input id="sim-name" name="nombreComercial" className="input" /></div>
              <div><label className="label" htmlFor="sim-phone">{t.phoneNumber}</label><input id="sim-phone" name="telefono" className="input font-mono" /></div>
              <div><label className="label" htmlFor="sim-reason">{t.integrationReason}</label><input id="sim-reason" name="motivo" className="input" required /></div>
              <div className="sm:col-span-2 flex justify-end"><SubmitButton>{t.integrationSimulateButton}</SubmitButton></div>
            </ActionForm>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="px-5 pt-5"><SectionTitle icon={<ScrollText className="h-4 w-4" />}>{t.integrationLog}</SectionTitle></div>
        {log.length === 0 ? (
          <div className="p-5"><Empty>{t.integrationNoLog}</Empty></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>{t.calledAtCol}</th><th>{t.what}</th><th>{t.status}</th><th>{t.integrationDetail}</th></tr></thead>
              <tbody>
                {log.map((l) => (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap text-sm">{fmtDateTime(l.at, lang)}</td>
                    <td className="whitespace-nowrap text-sm"><Plug className="mr-1 inline h-3.5 w-3.5 text-slate-400" />{KIND[l.kind] ?? l.kind}</td>
                    <td>{l.ok ? <span className="badge bg-emerald-50 text-emerald-800">OK</span> : <span className="badge bg-red-50 text-mitur-red">{t.integrationFailed}</span>}</td>
                    <td className="text-sm text-slate-600">{l.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
