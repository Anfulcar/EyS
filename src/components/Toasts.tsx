"use client";

import { CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";

const EVENT = "eys-toast";

// A short green notice at the top right that disappears by itself («Guardado», «3 tareas asignadas»…).
export function toast(message: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: message }));
}

export function Toasts() {
  const [list, setList] = useState<{ id: number; text: string }[]>([]);
  useEffect(() => {
    let n = 0;
    const add = (e: Event) => {
      const id = ++n;
      setList((l) => [...l.slice(-3), { id, text: String((e as CustomEvent).detail) }]);
      setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), 4500);
    };
    window.addEventListener(EVENT, add);
    return () => window.removeEventListener(EVENT, add);
  }, []);
  return (
    <div role="status" aria-live="polite" data-testid="notices" className="pointer-events-none fixed right-4 top-[calc(1rem+env(safe-area-inset-top))] z-[60] flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2">
      {list.map((x) => (
        <div key={x.id} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xl">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{x.text}</span>
        </div>
      ))}
    </div>
  );
}
