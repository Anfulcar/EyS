"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function CampaignTabs({ base, tabs }: { base: string; tabs: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="segmented max-w-full overflow-x-auto">
      {tabs.map((tab) => {
        const href = base + tab.href;
        return (
          <Link key={tab.href} href={href} aria-current={path === href ? "page" : undefined} className="whitespace-nowrap">
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
