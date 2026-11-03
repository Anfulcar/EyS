import { FlaskConical } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isDemoRequest } from "@/db";
import { DEMO_ENTRIES, demoOpen } from "@/lib/demo";
import type { Dict } from "@/lib/i18n";
import { getDict } from "@/lib/i18n-server";
import { demoSignInAction, enterDemoAction, leaveDemoAction } from "../../actions";

// «Entrar a la demo»: first the demo password, then one button per kind of work.
export default async function DemoEntryPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!(await demoOpen())) notFound();
  const { t } = await getDict();
  const { error } = await searchParams;
  const inside = isDemoRequest();
  return (
    <div className="mx-auto mt-10 max-w-md sm:mt-16">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-100 text-amber-800"><FlaskConical className="h-7 w-7" /></span>
        <h1 className="mt-4">{t.demoEnterTitle}</h1>
        <p className="subtitle">{inside ? t.demoChooseHelp : t.demoEnterHelp}</p>
      </div>
      {!inside ? (
        <form action={enterDemoAction} className="card space-y-4 p-6" data-testid="demo-password">
          {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error === "locked" ? t.demoLocked : t.demoWrong}</p>}
          <div>
            <label className="label" htmlFor="demo-password">{t.demoPassword}</label>
            <input id="demo-password" name="password" type="password" className="input" autoComplete="off" required autoFocus />
          </div>
          <button className="btn w-full">{t.demoEnter}</button>
        </form>
      ) : (
        <div className="card space-y-3 p-6" data-testid="demo-choose">
          <h2>{t.demoChooseTitle}</h2>
          {DEMO_ENTRIES.map((e) => (
            <form key={e.key} action={demoSignInAction}>
              <input type="hidden" name="as" value={e.key} />
              <button className="flex w-full flex-col items-start rounded-xl border border-slate-200 px-4 py-3 text-left transition hover:border-brand-400 hover:bg-brand-50">
                <span className="font-semibold text-slate-900">{t.demoAs.replace("{r}", t[`demoRole_${e.key}` as keyof Dict])}</span>
                <span className="text-xs text-slate-500">{t[`demoRoleHelp_${e.key}` as keyof Dict]}</span>
              </button>
            </form>
          ))}
          <form action={leaveDemoAction} className="pt-2 text-center"><button className="text-sm font-medium text-slate-500 hover:text-slate-800">{t.demoLeave}</button></form>
        </div>
      )}
      <p className="mt-4 text-center text-sm"><Link href="/login" className="text-slate-500 hover:text-slate-800">← {t.login}</Link></p>
    </div>
  );
}
