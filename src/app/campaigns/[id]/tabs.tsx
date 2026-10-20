"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function CampaignTabs({ base, tabs }: { base: string; tabs: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((tab) => {
        const href = base + tab.href;
        const active = path === href;
        return (
          <Link key={tab.href} href={href} className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${active ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
