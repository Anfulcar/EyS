"use client";

import { FileSpreadsheet, Upload } from "lucide-react";
import { useState } from "react";

// Friendly file picker (the browser's own button is grey and always in English).
export function FileField({ name = "file", label, onFile, accept = ".xlsx,.csv", required }: { name?: string; label: string; onFile?: (f: File) => void; accept?: string; required?: boolean }) {
  const [file, setFile] = useState<string | null>(null);
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-4 py-3 transition hover:border-brand-200 hover:bg-brand-50/40">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-brand-600 shadow-sm ring-1 ring-slate-200">
        {file ? <FileSpreadsheet className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
      </span>
      <span className="min-w-0 text-sm">
        <span className="block font-medium text-slate-800">{file ?? label}</span>
        <span className="block text-xs text-slate-500">Excel (.xlsx) / CSV</span>
      </span>
      <input
        type="file"
        name={name}
        accept={accept}
        required={required}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          setFile(f?.name ?? null);
          if (f) onFile?.(f);
        }}
      />
    </label>
  );
}
