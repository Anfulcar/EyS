"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

// The app's own confirmation window (instead of the browser's grey box).
export function ConfirmDialog({ message, confirmLabel, danger, onConfirm, onCancel }: {
  message: string; confirmLabel: React.ReactNode; danger?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  const en = typeof document !== "undefined" && document.documentElement.lang === "en";
  useEffect(() => {
    cancel.current?.focus();
    const key = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onCancel]);
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4 backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div role="alertdialog" aria-modal="true" aria-label={en ? "Confirm" : "Confirmar"} aria-describedby="confirm-message" className="w-full max-w-md space-y-5 rounded-2xl bg-white p-6 shadow-2xl">
        <h2>{en ? "Please confirm" : "Confirme, por favor"}</h2>
        <p id="confirm-message" className="whitespace-pre-line text-sm text-slate-700">{message}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <button ref={cancel} type="button" className="btn-secondary" onClick={onCancel}>{en ? "Cancel" : "Cancelar"}</button>
          <button type="button" className={danger ? "btn-danger" : "btn"} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
