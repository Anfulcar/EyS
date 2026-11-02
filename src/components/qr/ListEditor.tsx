"use client";

import { useState } from "react";

// One box per item and «+ Agregar», as in the preview (topics, institutions). Sent as one value per line.
export function ListEditor({ name, items, addLabel, label }: { name: string; items: string[]; addLabel: string; label: string }) {
  const [list, setList] = useState(items);
  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={list.join("\n")} />
      {list.map((v, i) => (
        <div key={i} className="flex gap-2">
          <input className="input min-w-0 flex-1" value={v} aria-label={`${label} ${i + 1}`} maxLength={100} onChange={(e) => setList(list.map((x, j) => (j === i ? e.target.value : x)))} />
          <button type="button" className="rounded-lg px-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={`× ${v}`} onClick={() => setList(list.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <button type="button" className="btn-secondary btn-sm" onClick={() => setList([...list, ""])}>{addLabel}</button>
    </div>
  );
}
