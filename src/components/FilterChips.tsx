import { X } from "lucide-react";
import Link from "next/link";
import { many, MULTI_SEP } from "@/lib/multi";

type Group = { key: string; label: string; options: { value: string; label: string }[] };

// The choices of the filters in use, each one removable with ×, plus «Quitar todos».
// keep = parameters that are not filters (tab, view…) and stay when filters are removed.
export function FilterChips({ path, sp, groups, keep = [], t }: {
  path: string; sp: Record<string, string | string[] | undefined>; groups: Group[]; keep?: string[]; t: { chipRemove: string; chipsClearAll: string };
}) {
  const base = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const val = Array.isArray(v) ? v.join(MULTI_SEP) : v;
    if (val && k !== "page") base.set(k, val);
  }
  const href = (q: URLSearchParams) => (q.toString() ? `${path}?${q}` : path);
  const chips = groups.flatMap((g) =>
    many(sp[g.key]).map((v) => {
      const q = new URLSearchParams(base);
      const rest = many(sp[g.key]).filter((x) => x !== v);
      if (rest.length) q.set(g.key, rest.join(MULTI_SEP));
      else q.delete(g.key);
      const text = g.options.find((o) => o.value === v)?.label ?? v;
      return { id: `${g.key}:${v}`, group: g.label, text, href: href(q) };
    }),
  );
  if (!chips.length) return null;
  const clear = new URLSearchParams();
  for (const k of keep) if (base.get(k)) clear.set(k, base.get(k)!);
  return (
    <div className="flex flex-wrap items-center gap-1.5" data-testid="filter-chips">
      {chips.map((c) => (
        <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pl-3 pr-1 text-xs text-brand-800">
          <span>{c.group}: <b className="font-semibold">{c.text}</b></span>
          <Link href={c.href} aria-label={t.chipRemove.replace("{v}", c.text)} className="grid h-5 w-5 place-items-center rounded-full hover:bg-white"><X className="h-3.5 w-3.5" /></Link>
        </span>
      ))}
      <Link href={href(clear)} className="ml-1 text-xs font-semibold text-brand-700 hover:underline">{t.chipsClearAll}</Link>
    </div>
  );
}
