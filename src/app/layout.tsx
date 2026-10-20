import type { Metadata } from "next";
import Link from "next/link";
import { logoutAction, setLangAction } from "./actions";
import { currentUser } from "@/lib/auth";
import { ROLES } from "@/lib/catalog";
import { getDict } from "@/lib/i18n-server";
import "./globals.css";

export const metadata: Metadata = { title: "EyS – Campañas" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { lang, t } = await getDict();
  const user = await currentUser();
  const role = user?.role;
  const nav: { href: string; label: string; show: boolean }[] = [
    { href: "/calls", label: t.navCalls, show: role === "agent" || role === "admin" || role === "supervisor" },
    { href: "/campaigns", label: t.navCampaigns, show: role === "admin" || role === "supervisor" },
    { href: "/visits", label: t.navVisits, show: !!role && role !== "agent" },
    { href: "/stats", label: t.navStats, show: role === "admin" || role === "supervisor" },
    { href: "/users", label: t.navUsers, show: role === "admin" },
  ];
  return (
    <html lang={lang}>
      <body>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold text-brand-700">
              <img src="/icon.svg" alt="" className="h-7 w-7" />
              {t.appName}
            </Link>
            {user && !user.mustChangePassword && (
              <nav className="flex flex-wrap gap-1 text-sm">
                {nav.filter((n) => n.show).map((n) => (
                  <Link key={n.href} href={n.href} className="rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                    {n.label}
                  </Link>
                ))}
              </nav>
            )}
            <div className="ml-auto flex items-center gap-3 text-sm">
              <form action={setLangAction} className="flex overflow-hidden rounded-md border border-slate-300">
                {(["es", "en"] as const).map((l) => (
                  <button key={l} name="lang" value={l} className={`px-2 py-1 text-xs font-medium ${lang === l ? "bg-brand-600 text-white" : "bg-white text-slate-600"}`}>
                    {l.toUpperCase()}
                  </button>
                ))}
              </form>
              {user && (
                <>
                  <Link href="/account" className="text-slate-600 hover:text-slate-900">
                    {user.name} <span className="text-xs text-slate-400">· {ROLES[user.role]?.[lang]}</span>
                  </Link>
                  <form action={logoutAction}>
                    <button className="btn-secondary btn-sm">{t.logout}</button>
                  </form>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
