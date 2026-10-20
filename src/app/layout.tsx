import { LogOut, PhoneCall } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { ConnectionBanner } from "@/components/ConnectionBanner";
import { Nav, type NavItem } from "@/components/Nav";
import { currentUser } from "@/lib/auth";
import { ROLES } from "@/lib/catalog";
import { getDict } from "@/lib/i18n-server";
import { logoutAction, setLangAction } from "./actions";
import "./globals.css";

export const metadata: Metadata = { title: "EyS – Campañas" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { lang, t } = await getDict();
  const user = await currentUser();
  const role = user?.role;
  const isManager = role === "admin" || role === "supervisor";
  const nav: NavItem[] = [
    ...(role && role !== "inspector" ? [{ href: "/calls", label: t.navCalls, icon: "calls" as const }] : []),
    ...(isManager ? [{ href: "/campaigns", label: t.navCampaigns, icon: "campaigns" as const }] : []),
    ...(role && role !== "agent" ? [{ href: "/visits", label: t.navVisits, icon: "visits" as const }] : []),
    ...(isManager ? [{ href: "/stats", label: t.navStats, icon: "stats" as const }] : []),
    ...(role === "admin" ? [{ href: "/users", label: t.navUsers, icon: "users" as const }] : []),
  ];
  const showNav = !!user && !user.mustChangePassword;

  const langSwitch = (
    <form action={setLangAction} className="inline-flex rounded-lg bg-slate-100 p-0.5">
      {(["es", "en"] as const).map((l) => (
        <button key={l} name="lang" value={l} className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${lang === l ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
          {l.toUpperCase()}
        </button>
      ))}
    </form>
  );
  const logo = (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
        <PhoneCall className="h-[18px] w-[18px]" />
      </span>
      <span className="text-[15px] font-bold leading-tight text-slate-900">{t.appName}</span>
    </Link>
  );

  return (
    <html lang={lang}>
      <body>
        <div className="flex min-h-screen">
          {showNav && (
            <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200/70 bg-white px-4 py-5 lg:flex">
              {logo}
              <div className="mt-8 flex-1"><Nav items={nav} /></div>
              <div className="space-y-3 border-t border-slate-100 pt-4">
                <Link href="/account" className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-slate-50">
                  <Avatar name={user!.name} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-900">{user!.name}</span>
                    <span className="block truncate text-xs text-slate-500">{ROLES[user!.role]?.[lang]}</span>
                  </span>
                </Link>
                <div className="flex items-center justify-between px-2">
                  {langSwitch}
                  <form action={logoutAction}>
                    <button className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-rose-600"><LogOut className="h-3.5 w-3.5" />{t.logout}</button>
                  </form>
                </div>
              </div>
            </aside>
          )}
          <div className="min-w-0 flex-1">
            <header className={`border-b border-slate-200/70 bg-white ${showNav ? "lg:hidden" : ""}`}>
              <div className="flex items-center gap-3 px-4 py-3">
                {logo}
                <div className="ml-auto flex items-center gap-3">
                  {langSwitch}
                  {showNav && (
                    <form action={logoutAction}><button className="text-slate-500 hover:text-rose-600" aria-label={t.logout}><LogOut className="h-5 w-5" /></button></form>
                  )}
                </div>
              </div>
              {showNav && <div className="px-3 pb-2"><Nav items={nav} mobile /></div>}
            </header>
            <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
            <ConnectionBanner retryLabel={t.retry} />
          </div>
        </div>
      </body>
    </html>
  );
}
