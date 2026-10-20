import { redirect } from "next/navigation";
import { currentUser, homeFor } from "@/lib/auth";
import { getDict } from "@/lib/i18n-server";
import { loginAction } from "../actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const u = await currentUser();
  if (u) redirect(homeFor(u.role));
  const { t } = await getDict();
  const { error } = await searchParams;
  return (
    <div className="mx-auto mt-16 max-w-sm">
      <form action={loginAction} className="card space-y-4">
        <h1>{t.login}</h1>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error === "locked" ? t.locked : t.invalidLogin}</p>}
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
    </div>
  );
}
