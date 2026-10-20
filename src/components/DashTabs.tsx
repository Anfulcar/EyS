"use client";

import { useState } from "react";

// Shows one detail table at a time.
export function DashTabs({ tabs }: { tabs: { id: string; label: string; content: React.ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  return (
    <div className="card p-0">
      <div className="flex flex-wrap gap-1 border-b border-slate-100 px-4 pt-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActive(t.id)}
            className={`-mb-px border-b-2 px-3 pb-2.5 text-sm font-medium transition ${active === t.id ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">{tabs.find((t) => t.id === active)?.content}</div>
    </div>
  );
}
