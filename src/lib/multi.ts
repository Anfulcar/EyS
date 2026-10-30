// Filters with several choices travel in the address as one value separated by "|"
// (a link with a single value, as before this change, still works).
export const MULTI_SEP = "|";

export function many(v: string | string[] | null | undefined): string[] {
  const list = Array.isArray(v) ? v : v ? [v] : [];
  return [...new Set(list.flatMap((x) => x.split(MULTI_SEP)).map((x) => x.trim()).filter(Boolean))];
}

// Whole numbers only (ids of campaigns, agents…).
export function manyIds(v: string | string[] | null | undefined): number[] {
  return many(v).map(Number).filter((n) => Number.isInteger(n) && n > 0);
}
