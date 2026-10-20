"use client";

import { BarChart3, CircleHelp, Megaphone, MapPin, Phone, ScrollText, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS = { calls: Phone, campaigns: Megaphone, visits: MapPin, stats: BarChart3, users: Users, logs: ScrollText, help: CircleHelp };
export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; badge?: number };

export function Nav({ items, mobile }: { items: NavItem[]; mobile?: boolean }) {
  const path = usePathname();
  return (
    <nav className={mobile ? "flex gap-1 overflow-x-auto" : "flex flex-col gap-1"}>
      {items.map((n) => {
        const Icon = ICONS[n.icon];
        const active = path === n.href || path.startsWith(n.href + "/");
        return (
          <Link
            key={n.href}
            href={n.href}
            className={`flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
            {n.label}
            {!!n.badge && (
              <span className="ml-auto min-w-[1.5rem] rounded-full bg-mitur-red px-1.5 py-0.5 text-center text-xs font-semibold text-white" aria-label={`${n.badge}`}>
                {n.badge > 99 ? "99+" : n.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
