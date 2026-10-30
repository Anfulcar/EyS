"use client";

import { ChevronsLeft, Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV_COOKIE } from "@/lib/ui-prefs";
import { Nav, type NavItem } from "./Nav";

// Side menu on computers: stays in view while scrolling and folds down to icons.
// The choice is kept on that computer (a cookie, so the page opens already folded).
export function SideNav({ items, folded: initial, logo, smallLogo, account, accountFolded, footer, t }: {
  items: NavItem[]; folded: boolean; logo: React.ReactNode; smallLogo: React.ReactNode; account: React.ReactNode; accountFolded: React.ReactNode; footer: React.ReactNode;
  t: { foldMenu: string; unfoldMenu: string };
}) {
  const [folded, setFolded] = useState(initial);
  const toggle = () => {
    const next = !folded;
    setFolded(next);
    document.cookie = `${NAV_COOKIE}=${next ? "folded" : "open"}; path=/; max-age=31536000; samesite=lax`;
  };
  const label = folded ? t.unfoldMenu : t.foldMenu;
  return (
    <aside className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-slate-200/70 bg-white py-5 transition-[width] lg:flex ${folded ? "w-[4.5rem] px-2" : "w-64 px-4"}`} data-folded={folded ? "1" : "0"}>
      {folded ? <div className="flex justify-center">{smallLogo}</div> : logo}
      <div className="mt-8 flex-1 overflow-y-auto"><Nav items={items} folded={folded} /></div>
      <div className="space-y-3 border-t border-slate-100 pt-4">
        {folded ? accountFolded : account}
        {!folded && footer}
        <button
          type="button"
          onClick={toggle}
          title={label}
          aria-label={label}
          className={`flex w-full items-center gap-2 rounded-xl border border-dashed border-slate-200 py-2 text-xs font-medium text-slate-500 transition hover:border-brand-300 hover:text-brand-700 ${folded ? "justify-center" : "px-3"}`}
        >
          <ChevronsLeft className={`h-4 w-4 shrink-0 transition ${folded ? "rotate-180" : ""}`} />
          {!folded && label}
        </button>
      </div>
    </aside>
  );
}

// Phones and tablets: the menu opens from a ☰ button as a side panel.
export function MobileNav({ items, account, t }: { items: NavItem[]; account: React.ReactNode; t: { openMenu: string; closeMenu: string } }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  // Closes after moving to another page.
  const [at, setAt] = useState(path);
  if (at !== path) { setAt(path); setOpen(false); }
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = ""; };
  }, [open]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={t.openMenu} aria-expanded={open} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50">
        <Menu className="h-5 w-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label={t.openMenu} className="flex h-full w-72 max-w-[85vw] flex-col gap-4 overflow-y-auto bg-white px-4 pb-5 pt-[calc(1rem+env(safe-area-inset-top))] shadow-2xl">
            <div className="flex justify-end">
              <button type="button" onClick={() => setOpen(false)} aria-label={t.closeMenu} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1"><Nav items={items} /></div>
            <div className="border-t border-slate-100 pt-3">{account}</div>
          </div>
        </div>
      )}
    </>
  );
}
