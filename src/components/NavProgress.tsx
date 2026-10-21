"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

// Thin bar at the top that appears the moment a link inside the app is clicked,
// so people see the click was received while the next screen loads.
export function NavProgress() {
  const path = usePathname();
  const search = useSearchParams();
  const [busy, setBusy] = useState(false);

  useEffect(() => setBusy(false), [path, search]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      setBusy(true);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (!busy) return;
    // Never stays on forever (e.g. a link that ends up on the same screen).
    const t = setTimeout(() => setBusy(false), 15000);
    return () => clearTimeout(t);
  }, [busy]);

  if (!busy) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 h-1 overflow-hidden bg-brand-100" role="progressbar" aria-label="…">
      <div className="h-full w-1/3 animate-[navprogress_1s_ease-in-out_infinite] bg-mitur-yellow" />
    </div>
  );
}
