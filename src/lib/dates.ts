// Dates are stored as ISO strings: "YYYY-MM-DD" for days, full ISO for timestamps.
// Operations run in the Dominican Republic (UTC-4, no DST).
const TZ_OFFSET_MIN = -4 * 60;

export function nowIso() {
  return new Date().toISOString();
}

export function todayLocal(): string {
  const d = new Date(Date.now() + TZ_OFFSET_MIN * 60000);
  return d.toISOString().slice(0, 10);
}

export function addBusinessDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00Z`);
  let left = days;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d.toISOString().slice(0, 10);
}

export function addHours(iso: string, h: number) {
  return new Date(new Date(iso).getTime() + h * 3600000).toISOString();
}

// Local (UTC-4) start of a business day as an ISO timestamp, 08:00.
export function businessDayStart(isoDate: string) {
  return new Date(`${isoDate}T12:00:00Z`).toISOString();
}

export function fmtDate(v: string | null | undefined, lang: "es" | "en" = "es") {
  if (!v) return "";
  const d = new Date(v.length === 10 ? `${v}T12:00:00Z` : v);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleDateString(lang === "es" ? "es-DO" : "en-US", { timeZone: "America/Santo_Domingo", year: "numeric", month: "short", day: "numeric" });
}

export function fmtDateTime(v: string | null | undefined, lang: "es" | "en" = "es") {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleString(lang === "es" ? "es-DO" : "en-US", { timeZone: "America/Santo_Domingo", dateStyle: "medium", timeStyle: "short" });
}

// Converts Excel/CSV cell values to "YYYY-MM-DD".
export function toIsoDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    // Excel serial date
    const d = new Date(Math.round((v - 25569) * 86400000));
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; // dd/mm/yyyy
  return null;
}

// First and last instant (UTC ISO) of a local (UTC-4) day, for "from / to" date filters.
export function localDayStart(isoDate: string) {
  return new Date(`${isoDate}T04:00:00Z`).toISOString();
}
export function localDayEnd(isoDate: string) {
  return new Date(new Date(`${isoDate}T04:00:00Z`).getTime() + 86400000 - 1).toISOString();
}
