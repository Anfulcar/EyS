"use client";

import { ArrowLeft } from "lucide-react";

// Back to wherever the person came from (Estadísticas, Tablero or Seguimiento).
export function BackLink({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => history.back()} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
      <ArrowLeft className="h-4 w-4" />{label}
    </button>
  );
}
