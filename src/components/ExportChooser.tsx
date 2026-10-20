"use client";

import { Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EXPORT_SHEETS, type ExportFilters, type ExportSheetKey } from "@/lib/export-spec";
import type { Dict } from "@/lib/i18n";

type Opt = { value: string; label: string };
type Saved = { sheets: Record<string, string[]>; filters: ExportFilters };

const STORE = "eys.export.v1";
const allChosen = (): Record<string, string[]> => Object.fromEntries(EXPORT_SHEETS.map((s) => [s.key, [...s.columns]]));

export function ExportChooser({ action, t, agents, zones, priorities, codes, statuses }: {
  action: string;
  t: Dict;
  agents: Opt[];
  zones: Opt[];
  priorities: Opt[];
  codes: Opt[];
  statuses: Opt[];
}) {
  const [chosen, setChosen] = useState<Record<string, string[]>>(allChosen);
  const [filters, setFilters] = useState<ExportFilters>({});
  const [error, setError] = useState("");
  const loaded = useRef(false);

  // Remembers the last choice in this browser (only a convenience: nothing breaks without it).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) {
        const s = JSON.parse(raw) as Saved;
        const valid: Record<string, string[]> = {};
        for (const sh of EXPORT_SHEETS) if (Array.isArray(s.sheets?.[sh.key])) valid[sh.key] = s.sheets[sh.key].filter((c) => (sh.columns as readonly string[]).includes(c));
        setChosen(valid);
        setFilters(s.filters ?? {});
      }
    } catch {}
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(STORE, JSON.stringify({ sheets: chosen, filters } satisfies Saved));
    } catch {}
  }, [chosen, filters]);

  const toggleSheet = (key: ExportSheetKey, on: boolean) => {
    const spec = EXPORT_SHEETS.find((s) => s.key === key)!;
    setChosen((c) => {
      const n = { ...c };
      if (on) n[key] = [...spec.columns];
      else delete n[key];
      return n;
    });
  };
  const toggleCol = (key: ExportSheetKey, col: string, on: boolean) => {
    const spec = EXPORT_SHEETS.find((s) => s.key === key)!;
    setChosen((c) => {
      const cur = new Set(c[key] ?? []);
      if (on) cur.add(col);
      else cur.delete(col);
      return { ...c, [key]: spec.columns.filter((x) => cur.has(x)) };
    });
  };
  const setFilter = (k: keyof ExportFilters, v: string) => setFilters((f) => ({ ...f, [k]: v || undefined }));
  const anything = Object.values(chosen).some((cols) => cols.length > 0);

  const select = (k: keyof ExportFilters, lbl: string, opts: Opt[]) => (
    <div>
      <label className="label" htmlFor={`f-${k}`}>{lbl}</label>
      <select id={`f-${k}`} name={k} value={filters[k] ?? ""} onChange={(e) => setFilter(k, e.target.value)} className="input">
        <option value="">{t.all}</option>
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );

  return (
    <form
      method="get"
      action={action}
      className="space-y-4"
      onSubmit={(e) => {
        if (!anything) {
          e.preventDefault();
          setError(t.exportNoSheet);
        } else setError("");
      }}
    >
      <input type="hidden" name="custom" value="1" />
      <div className="card space-y-3">
        <h2>{t.exportSheets}</h2>
        <div className="space-y-2">
          {EXPORT_SHEETS.map((s) => {
            const cols = chosen[s.key];
            const on = cols !== undefined;
            return (
              <details key={s.key} className="rounded-xl bg-slate-50 p-3">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 font-medium text-slate-800" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" name="sheet" value={s.key} checked={on} onChange={(e) => toggleSheet(s.key, e.target.checked)} className="h-4 w-4 accent-brand-600" />
                    {s.name}
                  </label>
                  <span className="text-xs text-slate-500">{on ? `${cols.length} / ${s.columns.length}` : "—"}</span>
                  <span className="ml-auto text-xs font-medium text-brand-700">{t.exportColumnsToggle}</span>
                </summary>
                <div className="mt-3 flex gap-3 text-xs">
                  <button type="button" className="font-medium text-brand-700 hover:underline" onClick={() => toggleSheet(s.key, true)}>{t.exportAllCols}</button>
                  <button type="button" className="font-medium text-brand-700 hover:underline" onClick={() => setChosen((c) => ({ ...c, [s.key]: [] }))}>{t.exportNoCols}</button>
                </div>
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {s.columns.map((col) => (
                    <label key={col} className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" name={`c_${s.key}`} value={col} checked={!!cols?.includes(col)} disabled={!on} onChange={(e) => toggleCol(s.key, col, e.target.checked)} className="h-4 w-4 accent-brand-600" />
                      {col}
                    </label>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      </div>

      <div className="card space-y-3">
        <h2>{t.exportFilters}</h2>
        <p className="text-sm text-slate-500">{t.exportFiltersHelp}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><label className="label" htmlFor="f-from">{t.from}</label><input id="f-from" type="date" name="from" value={filters.from ?? ""} onChange={(e) => setFilter("from", e.target.value)} className="input" /></div>
          <div><label className="label" htmlFor="f-to">{t.to}</label><input id="f-to" type="date" name="to" value={filters.to ?? ""} onChange={(e) => setFilter("to", e.target.value)} className="input" /></div>
          {select("agent", t.assignedTo, agents)}
          {select("zone", t.zone, zones)}
          {select("priority", t.priority, priorities)}
          {select("code", t.result, codes)}
          {select("status", t.taskStatus, statuses)}
        </div>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-mitur-red" role="alert">{error}</p>}
      <div className="flex justify-end">
        <button className="btn"><Download className="h-4 w-4" />{t.exportDownloadXlsx}</button>
      </div>
    </form>
  );
}
