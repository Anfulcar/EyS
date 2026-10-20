"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

type Props = {
  trigger: React.ReactNode;
  title: string;
  children: React.ReactNode;
  // "modal" = centred pop-up window; "drawer" = side panel from the right.
  variant?: "modal" | "drawer";
  triggerClassName?: string;
  width?: string;
};

// Button that opens its content in a pop-up window or a side panel. Closes with ✕, Escape or a click outside.
export function Overlay({ trigger, title, children, variant = "modal", triggerClassName = "btn", width }: Props) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);
  const panel =
    variant === "drawer"
      ? `fixed inset-y-0 right-0 flex w-full flex-col bg-white shadow-2xl ${width ?? "max-w-xl"}`
      : `relative mx-auto my-8 flex max-h-[calc(100vh-4rem)] w-[calc(100%-2rem)] flex-col rounded-2xl bg-white shadow-2xl ${width ?? "max-w-2xl"}`;
  return (
    <>
      <button type="button" className={triggerClassName} onClick={() => setOpen(true)}>
        {trigger}
      </button>
      {open && (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-900/40 backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label={title} className={panel}>
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
              <h2>{title}</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto px-6 py-5">{children}</div>
          </div>
        </div>
      )}
    </>
  );
}
