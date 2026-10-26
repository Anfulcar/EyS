import { codeLabel, COMPANY_STATUSES, label, OPERATION_LABELS, type Lang } from "./catalog";
import type { Dict } from "./i18n";
import type { DrillFilter } from "./stats";

// Human title for a list opened from the dashboard, e.g. "Requieren visita · Zona: A1".
export function drillTitle(f: DrillFilter, t: Dict, lang: Lang, agentName?: string | null) {
  const metric: Record<string, string> = {
    all: t.universe, called: t.kpiCalled, effective: t.kpiContact, contacted: t.contacts, typified: t.kpiTypified, operatingContacted: t.drillOperatingContacted,
    commitments: t.kpiCommitments, commitmentsDue: t.drillCommitmentsDue, commitmentsKept: t.kpiCompliance, closed: t.kpiClosed,
    needVisit: t.kpiVisit, notified: t.kpiCoverage, emailsSent: t.emailsSent, bounced: t.emailsBounced,
    expiredOperating: t.drillExpiredOperating, expiredInProcess: t.kpiAdvanceExpired, noLicenseOperating: t.drillNoLicenseOperating, noLicenseApplied: t.kpiAdvanceNoLicense,
    operating: OPERATION_LABELS.yes[lang],
  };
  const dim: Record<string, [string, (v: string) => string]> = {
    code: [t.result, (v) => codeLabel(v, lang)],
    status: [t.status, (v) => label(COMPANY_STATUSES, v, lang)],
    estatus: [t.byStatus, (v) => v],
    channel: [t.byChannel, (v) => v],
    zone: [t.zone, (v) => v],
    priority: [t.priority, (v) => v],
    subsector: ["Subsector", (v) => v],
    agent: [t.agent, (v) => agentName ?? v],
    operation: [t.opTitle, (v) => label(OPERATION_LABELS, v, lang)],
  };
  const parts = [];
  if (f.metric && f.metric !== "all") parts.push(metric[f.metric]);
  if (f.dim) parts.push(`${dim[f.dim][0]}: ${dim[f.dim][1](f.value ?? "")}`);
  return parts.join(" · ") || t.universe;
}
