"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// «?» next to a title: a short explanation on hover, focus or tap, without leaving the page.
// It is not a real button so it can sit inside a link (the card stays clickable).
export function Hint({ text, label = "?" }: { text: string; label?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const w = Math.min(280, window.innerWidth - 16);
    setPos({ left: Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2)), top: r.bottom + 8 });
  };
  const hide = () => setPos(null);
  useEffect(() => {
    if (!pos) return;
    const away = (e: Event) => !ref.current?.contains(e.target as Node) && hide();
    const key = (e: KeyboardEvent) => e.key === "Escape" && hide();
    window.addEventListener("scroll", hide, { passive: true });
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => { window.removeEventListener("scroll", hide); document.removeEventListener("mousedown", away); document.removeEventListener("keydown", key); };
  }, [pos]);
  return (
    <>
      <span
        ref={ref}
        role="button"
        tabIndex={0}
        aria-label={text}
        aria-expanded={!!pos}
        data-testid="hint"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); show(); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); show(); } }}
        className="ml-1 inline-grid h-4 w-4 shrink-0 cursor-help place-items-center rounded-full border border-slate-300 align-middle text-[10px] font-bold leading-none text-slate-500 hover:border-brand-500 hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-200"
      >
        {label}
      </span>
      {pos && createPortal(
        <div role="tooltip" style={{ left: pos.left, top: pos.top, width: Math.min(280, window.innerWidth - 16) }} className="pointer-events-none fixed z-50 rounded-lg bg-slate-900 px-3 py-2 text-xs font-normal leading-relaxed text-white shadow-xl">
          {text}
        </div>,
        document.body,
      )}
    </>
  );
}
