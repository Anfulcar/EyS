"use client";

import { BarChart3, CircleHelp, ClipboardCheck, ClipboardPen, FileText, Megaphone, MapPin, MessageSquareWarning, Phone, Plug, ScrollText, Settings2, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS = { calls: Phone, reviews: ClipboardCheck, reports: FileText, campaigns: Megaphone, visits: MapPin, stats: BarChart3, users: Users, logs: ScrollText, integrations: Plug, help: CircleHelp, settings: Settings2, admin: ShieldCheck, complaints: MessageSquareWarning, form: ClipboardPen };
// match = other addresses that light up this item (a panel with several pages).
// group = the module it belongs to; the menu shows each module's name above its items.
export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; badge?: number; match?: string[]; group?: string; exact?: boolean };

// folded = only the icons (the name shows on hover), with the number as a small dot.
export function Nav({ items, folded }: { items: NavItem[]; folded?: boolean }) {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {items.map((n, i) => {
        const header = n.group && n.group !== items[i - 1]?.group ? n.group : null;
        const Icon = ICONS[n.icon];
        // exact: only the address itself (a module's first page); match: other pages that light it up.
        const active = path === n.href || (!n.exact && path.startsWith(n.href + "/")) || (n.match ?? []).some((h) => path === h || path.startsWith(h));
        const badge = n.badge ? (n.badge > 99 ? "99+" : String(n.badge)) : "";
        return (
          <div key={n.href} className="contents">
          {header && (folded ? <hr className="mx-2 my-2 border-slate-200" /> : <div className={`px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 ${i ? "pt-4" : ""}`}>{header}</div>)}
          <Link
            href={n.href}
            title={folded ? n.label : undefined}
            aria-label={folded ? n.label : undefined}
            className={`relative flex items-center gap-3 whitespace-nowrap rounded-xl py-2.5 text-sm font-medium transition ${folded ? "justify-center px-0" : "px-3"} ${
              active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
            {!folded && n.label}
            {badge && (
              <span
                className={folded
                  ? "absolute right-1 top-1 min-w-[1.1rem] rounded-full bg-mitur-red px-1 text-center text-[10px] font-semibold leading-4 text-white"
                  : "ml-auto min-w-[1.5rem] rounded-full bg-mitur-red px-1.5 py-0.5 text-center text-xs font-semibold text-white"}
                aria-label={badge}
              >
                {badge}
              </span>
            )}
          </Link>
          </div>
        );
      })}
    </nav>
  );
}
