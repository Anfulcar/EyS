"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { many, MULTI_SEP } from "@/lib/multi";

type Option = { value: string; label: string };
type Labels = { all: string; msSelected: string; msClear: string; msDone: string; msSearch: string };

// A filter where several options can be ticked. It sends one value (the ticked options joined by "|")
// with the rest of the filter form, so the form keeps working as before. Give it key={value} so it follows the address.
export function MultiSelect({ name, options, value, t, id, className = "", allLabel }: {
  name: string; options: Option[]; value?: string | string[]; t: Labels; id?: string; className?: string; allLabel?: string;
}) {
  const [picked, setPicked] = useState<string[]>(() => many(value));
  const [open, setOpen] = useState(false);
  const [right, setRight] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); button.current?.focus(); } };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    // Opens to the left when there is no room on the right (phones, last column).
    const r = pop.current?.getBoundingClientRect();
    setRight(!!r && r.right > window.innerWidth - 8);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", key); };
  }, [open]);

  const labels = options.filter((o) => picked.includes(o.value)).map((o) => o.label);
  const text = !labels.length ? allLabel ?? t.all : labels.length <= 2 ? labels.join(", ") : t.msSelected.replace("{n}", String(labels.length));
  const toggle = (v: string) => setPicked((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));
  const shown = q ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())) : options;

  return (
    <div ref={box} className={`relative ${className}`}>
      <input type="hidden" name={name} value={picked.join(MULTI_SEP)} />
      <button
        ref={button}
        id={id}
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
        className={`input flex items-center justify-between gap-2 text-left ${labels.length ? "border-brand-500 bg-brand-50 font-medium text-brand-800" : ""}`}
      >
        <span className="truncate">{text}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div ref={pop} className={`absolute top-full z-30 mt-1 flex w-full min-w-[16rem] max-w-[calc(100vw-2rem)] flex-col gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-xl ${right ? "right-0" : "left-0"}`}>
          {options.length > 8 && (
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.msSearch} aria-label={t.msSearch} className="input mb-1 py-1.5" autoFocus />
          )}
          <div role="group" aria-label={text} className="max-h-64 overflow-y-auto">
            {shown.map((o) => (
              <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={picked.includes(o.value)} onChange={() => toggle(o.value)} />
                <span className="min-w-0 flex-1">{o.label}</span>
              </label>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 pt-2">
            <button type="button" className="text-xs font-semibold text-brand-700 hover:underline disabled:opacity-40" disabled={!picked.length} onClick={() => setPicked([])}>{t.msClear}</button>
            <button type="button" className="btn btn-sm" onClick={() => { setOpen(false); button.current?.focus(); }}>{t.msDone}</button>
          </div>
        </div>
      )}
    </div>
  );
}
