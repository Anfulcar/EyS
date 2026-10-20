import { BookOpen, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { ROLES } from "@/lib/catalog";
import { fmtDate } from "@/lib/dates";
import { getDict } from "@/lib/i18n-server";
import { MANUAL, WHATS_NEW } from "@/lib/manual";

export default async function HelpPage() {
  const me = await requireUser();
  const { t, lang } = await getDict();
  const sections = MANUAL[lang].filter((s) => s.roles.includes(me.role));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2"><BookOpen className="h-6 w-6 text-brand-600" />{t.helpTitle}</h1>
        <p className="subtitle">{t.helpSubtitle} <b>{ROLES[me.role]?.[lang]}</b>.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav className="card h-fit space-y-1 p-3 text-sm lg:sticky lg:top-6">
          {sections.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="block rounded-lg px-2.5 py-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900">{s.title}</a>
          ))}
          <a href="#whats-new" className="block rounded-lg px-2.5 py-1.5 font-medium text-brand-700 hover:bg-brand-50">{t.whatsNew}</a>
        </nav>
        <div className="space-y-4">
          {sections.map((s) => (
            <section key={s.id} id={s.id} className="card scroll-mt-6 space-y-3">
              <h2>{s.title}</h2>
              {s.intro && <p className="text-sm text-slate-600">{s.intro}</p>}
              {s.steps && (
                <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700 marker:text-brand-500">
                  {s.steps.map((x) => <li key={x}>{x}</li>)}
                </ul>
              )}
              {s.bullets && (
                <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700 marker:text-brand-500">
                  {s.bullets.map((x) => <li key={x}>{x}</li>)}
                </ul>
              )}
            </section>
          ))}
          <section id="whats-new" className="card scroll-mt-6">
            <h2 className="mb-3 flex items-center gap-2"><Sparkles className="h-5 w-5 text-amber-500" />{t.whatsNew}</h2>
            <ul className="space-y-2.5 text-sm">
              {WHATS_NEW.map((w) => (
                <li key={w.es} className="flex gap-3">
                  <span className="w-24 shrink-0 text-xs font-medium text-slate-500">{fmtDate(w.date, lang)}</span>
                  <span className="text-slate-700">{w[lang]}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
