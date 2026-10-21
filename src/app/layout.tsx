import { FlaskConical, LogOut } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { ConnectionBanner } from "@/components/ConnectionBanner";
import { Nav, type NavItem } from "@/components/Nav";
import { NavProgress } from "@/components/NavProgress";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { currentUser } from "@/lib/auth";
import { attentionSummary } from "@/lib/queue";
import { syncCoverage } from "@/lib/team";
import { ROLES } from "@/lib/catalog";
import { getDict } from "@/lib/i18n-server";
import { logoutAction, setLangAction } from "./actions";
import "./globals.css";

export const metadata: Metadata = { title: "EyS – Campañas" };

const isManagerRole = (r: string | undefined) => r === "admin" || r === "supervisor";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Covers for absences start and end by date (throttled; never blocks the page on failure).
  const [{ lang, t }, user] = await Promise.all([getDict(), currentUser(), syncCoverage().catch((e) => console.error("[coverage]", e))]);
  const role = user?.role;
  const isManager = role === "admin" || role === "supervisor";
  // Administrators and supervisors see "Mis llamadas" only when they have calls assigned.
  // Both menu numbers are asked for at the same time.
  const [assigned, attention] = user && (role === "agent" || isManagerRole(role))
    ? await Promise.all([
        role === "agent" ? Promise.resolve(1) : db.select({ n: sql<number>`count(*)` }).from(companies).where(eq(companies.assignedUserId, user.id)).then((r) => Number(r[0].n)),
        attentionSummary(user.id),
      ])
    : [0, null];
  const hasCalls = assigned > 0;
  const nav: NavItem[] = [
    ...(hasCalls ? [{ href: "/calls", label: t.navCalls, icon: "calls" as const, badge: attention?.total ?? 0 }] : []),
    ...(role && role !== "inspector" ? [{ href: "/reviews", label: t.navReviews, icon: "reviews" as const }] : []),
    ...(isManager ? [{ href: "/campaigns", label: t.navCampaigns, icon: "campaigns" as const }] : []),
    ...(role && role !== "agent" ? [{ href: "/visits", label: t.navVisits, icon: "visits" as const }] : []),
    ...(isManager ? [{ href: "/stats", label: t.navStats, icon: "stats" as const }] : []),
    ...(role === "admin" ? [{ href: "/users", label: t.navUsers, icon: "users" as const }] : []),
    ...(role === "admin" ? [{ href: "/logs", label: t.navLogs, icon: "logs" as const }] : []),
    ...(role ? [{ href: "/help", label: t.navHelp, icon: "help" as const }] : []),
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
    <Link href="/" className="flex items-center gap-3" aria-label={t.appName}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/mitur-logo.png" alt="Ministerio de Turismo – República Dominicana" className="h-11 w-auto" />
      <span className="border-l border-slate-200 pl-3 text-[13px] font-semibold leading-tight text-brand-700">{t.appName}</span>
    </Link>
  );

  return (
    <html lang={lang}>
      <body>
        <Suspense fallback={null}><NavProgress /></Suspense>
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
            {process.env.SEED_DEMO === "true" && (
              <div className="flex items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-center text-xs font-medium text-amber-900">
                <FlaskConical className="h-4 w-4 shrink-0" /> {t.demoBanner}
              </div>
            )}
            <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
            <ConnectionBanner retryLabel={t.retry} />
          </div>
        </div>
      </body>
    </html>
  );
}
