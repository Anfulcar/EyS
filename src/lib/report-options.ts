// What a report contains (shared by the report panel, the download and scheduled reports).
import type { Lang } from "./catalog";

type L = Record<Lang, string>;

export const REPORT_SECTIONS = ["goals", "counts", "campaigns", "codes", "agents", "breakdowns", "sigtur", "daily", "legend", "detail"] as const;
export type ReportSection = (typeof REPORT_SECTIONS)[number];
export const DEFAULT_SECTIONS: ReportSection[] = ["goals", "counts", "campaigns", "codes", "agents", "breakdowns", "daily"];

export const SECTION_LABELS: Record<ReportSection, L> = {
  goals: { es: "Resumen ejecutivo: las 4 metas del plan", en: "Executive summary: the plan's 4 goals" },
  counts: { es: "Conteos generales", en: "General counts" },
  campaigns: { es: "Comparación por campaña", en: "Comparison by campaign" },
  codes: { es: "Resultados por tipificación", en: "Results by outcome" },
  agents: { es: "Avance por agente", en: "Progress by agent" },
  breakdowns: { es: "Por zona, prioridad y subsector", en: "By zone, priority and subsector" },
  sigtur: { es: "Estatus SIGTUR y canal de logro", en: "SIGTUR status and channel" },
  daily: { es: "Llamadas por día (gráfico)", en: "Calls per day (chart)" },
  legend: { es: "Leyenda de etiquetas", en: "Label legend" },
  detail: { es: "Detalle de establecimientos (sin teléfonos ni contactos)", en: "Establishment detail (no phones or contacts)" },
};

export const DETAIL_FILTERS = ["needVisit", "commitments", "commitmentsDue", "closed", "all"] as const;
export type DetailFilter = (typeof DETAIL_FILTERS)[number];
export const DETAIL_LABELS: Record<DetailFilter, L> = {
  needVisit: { es: "Solo los que requieren visita", en: "Only those needing a visit" },
  commitments: { es: "Solo los que tienen compromiso", en: "Only those with a commitment" },
  commitmentsDue: { es: "Solo compromisos vencidos", en: "Only commitments past due" },
  closed: { es: "Solo los cerrados", en: "Only closed ones" },
  all: { es: "Todos los establecimientos", en: "All establishments" },
};

export const PERIOD_KINDS = ["all", "lastWeek", "last7", "thisMonth", "lastMonth", "custom"] as const;
export type PeriodKind = (typeof PERIOD_KINDS)[number];
export const PERIOD_LABELS: Record<PeriodKind, L> = {
  all: { es: "Todo", en: "Everything" },
  lastWeek: { es: "Semana pasada", en: "Last week" },
  last7: { es: "Últimos 7 días", en: "Last 7 days" },
  thisMonth: { es: "Mes en curso", en: "This month" },
  lastMonth: { es: "Mes pasado", en: "Last month" },
  custom: { es: "Fechas exactas", en: "Exact dates" },
};

export type ReportFormat = "pdf" | "pptx";

export type ReportOptions = {
  campaigns: "all" | "active" | "pick";
  campaignIds: number[];
  period: PeriodKind;
  from?: string;
  to?: string;
  title: string;
  comments: string;
  sections: ReportSection[];
  detail: DetailFilter;
  format: ReportFormat;
};

export const DEFAULT_OPTIONS: ReportOptions = {
  campaigns: "active",
  campaignIds: [],
  period: "all",
  title: "Informe – Plan de Formalización Región Este",
  comments: "",
  sections: DEFAULT_SECTIONS,
  detail: "needVisit",
  format: "pdf",
};

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

// Anything coming from a link, a saved template or the browser goes through here.
export function cleanOptions(o: Partial<ReportOptions> | null | undefined): ReportOptions {
  const v = o ?? {};
  const sections = Array.isArray(v.sections) ? REPORT_SECTIONS.filter((s) => v.sections!.includes(s)) : DEFAULT_SECTIONS;
  return {
    campaigns: v.campaigns === "all" || v.campaigns === "pick" ? v.campaigns : "active",
    campaignIds: Array.isArray(v.campaignIds) ? v.campaignIds.map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 200) : [],
    period: (PERIOD_KINDS as readonly string[]).includes(v.period as string) ? (v.period as PeriodKind) : "all",
    from: isDate(v.from) ? v.from : undefined,
    to: isDate(v.to) ? v.to : undefined,
    title: String(v.title ?? DEFAULT_OPTIONS.title).trim().slice(0, 140) || DEFAULT_OPTIONS.title,
    comments: String(v.comments ?? "").trim().slice(0, 2000),
    sections,
    detail: (DETAIL_FILTERS as readonly string[]).includes(v.detail as string) ? (v.detail as DetailFilter) : "needVisit",
    format: v.format === "pptx" ? "pptx" : "pdf",
  };
}

// Download links carry the choice as one JSON parameter.
export function optionsToQuery(o: ReportOptions) {
  return new URLSearchParams({ o: JSON.stringify(o) }).toString();
}
export function optionsFromQuery(sp: URLSearchParams) {
  try {
    return cleanOptions(JSON.parse(sp.get("o") ?? "{}"));
  } catch {
    return cleanOptions(null);
  }
}

// ---------- Periods (local dates, Dominican Republic) ----------

const addDays = (d: string, n: number) => new Date(new Date(`${d}T12:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
const weekday = (d: string) => ((new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7) + 1; // 1 = Monday … 7 = Sunday

export function resolvePeriod(o: Pick<ReportOptions, "period" | "from" | "to">, today: string): { from: string | null; to: string | null } {
  switch (o.period) {
    case "lastWeek": {
      const thisMonday = addDays(today, 1 - weekday(today));
      return { from: addDays(thisMonday, -7), to: addDays(thisMonday, -1) };
    }
    case "last7":
      return { from: addDays(today, -6), to: today };
    case "thisMonth":
      return { from: `${today.slice(0, 7)}-01`, to: today };
    case "lastMonth": {
      const firstThis = `${today.slice(0, 7)}-01`;
      const lastPrev = addDays(firstThis, -1);
      return { from: `${lastPrev.slice(0, 7)}-01`, to: lastPrev };
    }
    case "custom":
      if (o.from && o.to) return o.from <= o.to ? { from: o.from, to: o.to } : { from: o.to, to: o.from };
      return { from: o.from ?? null, to: o.to ?? null };
    default:
      return { from: null, to: null };
  }
}

// ---------- Schedules ----------

export const FREQUENCIES = ["none", "weekly", "biweekly", "monthly"] as const;
export type Frequency = (typeof FREQUENCIES)[number];
export const FREQUENCY_LABELS: Record<Frequency, L> = {
  none: { es: "A pedido", en: "On demand" },
  weekly: { es: "Semanal", en: "Weekly" },
  biweekly: { es: "Cada 2 semanas", en: "Every 2 weeks" },
  monthly: { es: "Mensual", en: "Monthly" },
};
export const WEEKDAY_LABELS: L[] = [
  { es: "lunes", en: "Monday" }, { es: "martes", en: "Tuesday" }, { es: "miércoles", en: "Wednesday" }, { es: "jueves", en: "Thursday" },
  { es: "viernes", en: "Friday" }, { es: "sábado", en: "Saturday" }, { es: "domingo", en: "Sunday" },
];

// First run date on or after `today` (weekly/biweekly: next given weekday; monthly: next given day of month).
export function firstRun(frequency: Frequency, runDay: number, today: string): string | null {
  if (frequency === "none") return null;
  if (frequency === "monthly") {
    const day = Math.min(28, Math.max(1, runDay));
    const candidate = `${today.slice(0, 7)}-${String(day).padStart(2, "0")}`;
    return candidate >= today ? candidate : nextMonthDay(candidate, day);
  }
  const wd = Math.min(7, Math.max(1, runDay));
  return addDays(today, (wd - weekday(today) + 7) % 7);
}

function nextMonthDay(d: string, day: number) {
  const [y, m] = d.split("-").map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// The run after `last` (keeps the rhythm even if a run happened late).
export function nextRun(frequency: Frequency, runDay: number, last: string, today: string): string | null {
  if (frequency === "none") return null;
  let next = frequency === "monthly" ? nextMonthDay(last, Math.min(28, Math.max(1, runDay))) : addDays(last, frequency === "weekly" ? 7 : 14);
  while (next <= today) next = frequency === "monthly" ? nextMonthDay(next, Math.min(28, Math.max(1, runDay))) : addDays(next, frequency === "weekly" ? 7 : 14);
  return next;
}

export function scheduleLabel(frequency: Frequency, runDay: number | null, lang: Lang) {
  if (frequency === "none" || runDay == null) return FREQUENCY_LABELS.none[lang];
  if (frequency === "monthly") return lang === "es" ? `Mensual · día ${runDay}` : `Monthly · day ${runDay}`;
  return `${FREQUENCY_LABELS[frequency][lang]} · ${WEEKDAY_LABELS[runDay - 1]?.[lang] ?? ""}`;
}
