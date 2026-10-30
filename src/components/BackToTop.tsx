"use client";

import { ArrowUp } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// «↑ Arriba» on long pages. Not on the call screen, where the «Guardar» bar sits at the bottom.
export function BackToTop({ label }: { label: string }) {
  const path = usePathname();
  const [show, setShow] = useState(false);
  useEffect(() => {
    const check = () => setShow(window.scrollY > 600);
    check();
    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }, []);
  if (!show || /^\/calls\/\d+/.test(path)) return null;
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })}
      className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-5 z-20 inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-xl transition hover:bg-brand-700 [.has-bulkbar_&]:bottom-[calc(5.5rem+env(safe-area-inset-bottom))]"
    >
      <ArrowUp className="h-4 w-4" />{label}
    </button>
  );
}
