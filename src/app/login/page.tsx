import { redirect } from "next/navigation";
import { DEMO_USERS } from "../../../scripts/seed-demo.mjs";
import { currentUser, homeFor } from "@/lib/auth";
import { ROLES } from "@/lib/catalog";
import { getDict } from "@/lib/i18n-server";
import { loginAction } from "../actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const u = await currentUser();
  if (u) redirect(homeFor(u.role));
  const { t, lang } = await getDict();
  const { error } = await searchParams;
  return (
    <div className="mx-auto mt-10 max-w-sm sm:mt-20">
      <div className="mb-6 flex flex-col items-center text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/mitur-logo.png" alt="Ministerio de Turismo – República Dominicana" className="h-28 w-auto rounded-2xl bg-white p-3 shadow-soft" />
        <h1 className="mt-6">{lang === "es" ? "¡Bienvenido!" : "Welcome!"}</h1>
        <p className="subtitle">{t.appName}</p>
      </div>
      <form action={loginAction} className="card space-y-4 p-6">
        {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error === "locked" ? t.locked : t.invalidLogin}</p>}
        <div>
          <label className="label" htmlFor="username">{t.username}</label>
          <input id="username" name="username" className="input" autoComplete="username" required autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="password">{t.password}</label>
          <input id="password" name="password" type="password" className="input" autoComplete="current-password" required />
        </div>
        <button className="btn w-full">{t.login}</button>
      </form>
      {process.env.SEED_DEMO === "true" && (
        <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
          <p className="font-medium">{t.demoUsers}</p>
          <ul className="mt-2 space-y-1 font-mono text-xs">
            {DEMO_USERS.map((u) => <li key={u.username}>{u.username} <span className="font-sans text-amber-700">· {ROLES[u.role]?.[lang]}</span></li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
