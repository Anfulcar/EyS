"use client";

import { useState, useTransition } from "react";
import type { ActionState } from "@/app/actions";
import { withConnectionCheck } from "@/lib/connection";
import type { Dict } from "@/lib/i18n";
import { Message } from "./ActionForm";
import { FileField } from "./FileField";

type Preview = {
  fileName: string; rows: number; valid: number; mapping: Record<string, string>; ignored: string[]; missing: string[];
  errors: { row: number; message: string }[]; errorCount: number; duplicates: string[]; duplicateCount: number;
  toInsert: number; toUpdate: number; companies: number; sample: Record<string, unknown>[];
};

type Act = (s: ActionState, f: FormData) => Promise<ActionState>;

export function ImportForm({ campaignId, t, preview: rawPreview, commit: rawCommit }: { campaignId: number; t: Dict; preview: Act; commit: Act }) {
  const preview = withConnectionCheck(rawPreview);
  const commit = withConnectionCheck(rawCommit);
  const [file, setFile] = useState<File | null>(null);
  const [p, setP] = useState<Preview | null>(null);
  const [state, setState] = useState<ActionState>(null);
  const [pending, start] = useTransition();
  const [resetKey, setResetKey] = useState(0);

  const fd = () => {
    const f = new FormData();
    f.set("campaignId", String(campaignId));
    f.set("file", file!);
    return f;
  };
  const doPreview = (f: File) => {
    setFile(f);
    setP(null);
    setState(null);
    const data = new FormData();
    data.set("campaignId", String(campaignId));
    data.set("file", f);
    start(async () => {
      const r = await preview(null, data);
      if (r?.ok) setP(r.data as Preview);
      else setState(r);
    });
  };
  const doCommit = () =>
    start(async () => {
      const r = await commit(null, fd());
      setState(r);
      if (r?.ok) {
        setP(null);
        setFile(null);
        setResetKey((k) => k + 1);
      }
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full max-w-md"><FileField key={resetKey} name="upload" label={t.chooseFile} onFile={doPreview} /></div>
        {pending && <span className="text-sm text-slate-500">…</span>}
      </div>
      <Message state={state} />
      {p && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3>{t.preview}: {p.fileName}</h3>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="card p-3"><div className="text-xs text-slate-500">{t.rowsDetected}</div><div className="text-xl font-semibold">{p.rows}</div></div>
            <div className="card p-3"><div className="text-xs text-slate-500">{t.willInsert}</div><div className="text-xl font-semibold">{p.toInsert}</div></div>
            <div className="card p-3"><div className="text-xs text-slate-500">{t.willUpdate}</div><div className="text-xl font-semibold">{p.toUpdate}</div></div>
            <div className="card p-3"><div className="text-xs text-slate-500">{t.companies}</div><div className="text-xl font-semibold">{p.companies}</div></div>
          </div>
          {p.missing.length > 0 && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{t.missingRequired}: {p.missing.join(", ")}</p>}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="label">{t.columnsMapped} ({Object.keys(p.mapping).length})</div>
              <div className="flex flex-wrap gap-1">{Object.entries(p.mapping).map(([k, v]) => <span key={k} className="badge bg-emerald-50 text-emerald-700" title={k}>{v}</span>)}</div>
            </div>
            {p.ignored.length > 0 && (
              <div>
                <div className="label">{t.columnsIgnored}</div>
                <div className="flex flex-wrap gap-1">{p.ignored.map((k) => <span key={k} className="badge bg-slate-200 text-slate-700">{k}</span>)}</div>
              </div>
            )}
          </div>
          {p.errorCount > 0 && (
            <div className="text-sm"><div className="label">{t.rowsWithErrors}: {p.errorCount}</div><ul className="list-disc pl-5 text-slate-600">{p.errors.slice(0, 10).map((e) => <li key={e.row}>#{e.row}: {e.message}</li>)}</ul></div>
          )}
          {p.duplicateCount > 0 && <p className="text-sm text-amber-700">{t.duplicatesInFile}: {p.duplicateCount} ({p.duplicates.slice(0, 10).join(", ")})</p>}
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="table text-xs">
              <thead><tr>{["sigturId", "nombreComercial", "razonSocial", "rnc", "estatusRnt", "prioridad", "telefono", "correo", "zonaOperativa"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>{p.sample.map((r, i) => <tr key={i}>{["sigturId", "nombreComercial", "razonSocial", "rnc", "estatusRnt", "prioridad", "telefono", "correo", "zonaOperativa"].map((h) => <td key={h}>{String(r[h] ?? "")}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <button className="btn" disabled={pending || p.missing.length > 0 || p.valid === 0} onClick={doCommit}>{t.confirmImport} ({p.valid})</button>
        </div>
      )}
    </div>
  );
}
