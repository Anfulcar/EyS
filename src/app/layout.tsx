import { FlaskConical, LogOut } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { ConnectionBanner } from "@/components/ConnectionBanner";
import { BackToTop } from "@/components/BackToTop";
import type { NavItem } from "@/components/Nav";
import { MobileNav, SideNav } from "@/components/SideNav";
import { Toasts } from "@/components/Toasts";
import { NavProgress } from "@/components/NavProgress";
import { eq, sql } from "drizzle-orm";
import { afterResponse, db, isDemoRequest } from "@/db";
import { companies } from "@/db/schema";
import { currentUser } from "@/lib/auth";
import { can, canAny } from "@/lib/permissions";
import { caseCounters } from "@/lib/qr";
import { QR_TEXT } from "@/lib/qr-i18n";
import { attentionSummary } from "@/lib/queue";
import { newReportsCount } from "@/lib/report-run";
import { syncCoverage } from "@/lib/team";
import { NAV_COOKIE } from "@/lib/ui-prefs";
import { cookies } from "next/headers";
import { sigturBackground } from "@/lib/sigtur-push";
import { ROLES } from "@/lib/catalog";
import { getDict } from "@/lib/i18n-server";
import { leaveDemoAction, logoutAction, resetDemoAction, setLangAction } from "./actions";
import { ActionForm, ConfirmButton } from "@/components/ActionForm";
import "./globals.css";

export const metadata: Metadata = { title: "Atención al Cliente EyS" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Covers for absences start and end by date (throttled; never blocks the page on failure).
  const [{ lang, t }, user] = await Promise.all([getDict(), currentUser(), syncCoverage().catch((e) => console.error("[coverage]", e))]);
  // Overdue SIGTUR requests and sending to SIGTUR, after the page is sent (never slows it down).
  afterResponse(() => sigturBackground().catch((e) => console.error("[sigtur]", e)));
  const inDemo = isDemoRequest();
  const c = (a: string) => can(user, a);
  // People who direct the campaigns («Asignar y mover tareas») see "Mis llamadas" only when they have calls
  // assigned; everyone else who makes calls always sees it. Both menu numbers are asked for at the same time.
  const caller = !!user && c("c.call");
  const directs = c("c.assign");
  const [assigned, attention] = user && caller
    ? await Promise.all([
        !directs ? Promise.resolve(1) : db.select({ n: sql<number>`count(*)` }).from(companies).where(eq(companies.assignedUserId, user.id)).then((r) => Number(r[0].n)),
        attentionSummary(user.id),
      ])
    : [0, null];
  const newReports = user && c("c.reports") ? await newReportsCount(user) : 0;
  const qt = QR_TEXT[lang];
  // «Casos» shows what waits for the person: who assigns or approves, unassigned cases and closings to approve;
  // handlers, their open cases.
  const qrCount = user && canAny(user, ["q.seeAll", "q.workMine"]) ? await caseCounters(user) : null;
  const qrBadge = !qrCount ? 0 : canAny(user, ["q.assign", "q.approve"]) ? qrCount.unassigned + qrCount.toApprove : qrCount.mine;
  const G = { calls: t.navGroupCalls, qr: qt.module, general: t.navGroupGeneral };
  // Each entry appears only when the person's profile allows it (the screens check again on the server).
  const nav: NavItem[] = [
    ...(caller && assigned > 0 ? [{ href: "/calls", label: t.navCalls, icon: "calls" as const, badge: attention?.total ?? 0 }] : []),
    ...(canAny(user, ["c.own", "c.review"]) ? [{ href: "/reviews", label: t.navReviews, icon: "reviews" as const }] : []),
    ...(c("c.view") ? [{ href: "/campaigns", label: t.navCampaigns, icon: "campaigns" as const }] : []),
    ...(c("c.visits") ? [{ href: "/visits", label: t.navVisits, icon: "visits" as const }] : []),
    ...(c("c.stats") ? [{ href: "/stats", label: t.navStats, icon: "stats" as const }] : []),
    ...(c("c.reports") ? [{ href: "/reports", label: t.navReports, icon: "reports" as const, badge: newReports }] : c("c.changes") ? [{ href: "/reports/changes", label: t.navReports, icon: "reports" as const }] : []),
    ...(c("c.settings") ? [{ href: "/calls-settings", label: t.navCallsSettings, icon: "settings" as const }] : []),
  ].map((n) => ({ ...n, group: G.calls }));
  if (c("q.register")) {
    nav.push(
      { href: "/quejas", label: qt.navCases, icon: "complaints", badge: qrBadge, exact: true, match: ["/quejas/QR"], group: G.qr },
      { href: "/formulario-quejas", label: qt.navPublicForm, icon: "form", group: G.qr },
    );
  }
  if (c("q.stats")) nav.push({ href: "/quejas/estadisticas", label: qt.tabStats, icon: "stats", group: G.qr });
  if (c("q.settings")) nav.push({ href: "/quejas/configuracion", label: qt.navModuleSettings, icon: "settings", group: G.qr });
  const adminHref = c("g.people") ? "/users" : c("g.perms") ? "/admin/permissions" : c("g.sigtur") ? "/integrations" : c("g.log") ? "/logs" : null;
  nav.push(
    ...(adminHref ? [{ href: adminHref, label: t.navAdmin, icon: "admin" as const, match: ["/users", "/admin", "/logs", "/integrations"], group: G.general }] : []),
    ...(user ? [{ href: "/help", label: t.navHelp, icon: "help" as const, group: G.general }] : []),
  );
  const showNav = !!user && !user.mustChangePassword;
  const folded = (await cookies()).get(NAV_COOKIE)?.value === "folded";

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

  const smallLogo = (
    <Link href="/" aria-label={t.appName} title={t.appName} className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-xs font-bold tracking-wide text-white">EyS</Link>
  );
  const account = user ? (
    <Link href="/account" className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-slate-50">
      <Avatar name={user.name} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-slate-900">{user.name}</span>
        <span className="block truncate text-xs text-slate-500">{user.profileName || ROLES[user.role]?.[lang]}</span>
      </span>
    </Link>
  ) : null;

  return (
    <html lang={lang}>
      <body>
        <Suspense fallback={null}><NavProgress /></Suspense>
        <div className="flex min-h-screen">
          {showNav && (
            <SideNav
              items={nav}
              folded={folded}
              logo={logo}
              smallLogo={smallLogo}
              account={account}
              accountFolded={
                <div className="flex flex-col items-center gap-2">
                  <Link href="/account" title={user!.name} aria-label={user!.name} className="rounded-full transition hover:opacity-80"><Avatar name={user!.name} /></Link>
                  <form action={logoutAction}><button className="rounded-lg p-1.5 text-slate-500 hover:text-rose-600" title={t.logout} aria-label={t.logout}><LogOut className="h-4 w-4" /></button></form>
                </div>
              }
              footer={
                <div className="flex items-center justify-between px-2">
                  {langSwitch}
                  <form action={logoutAction}>
                    <button className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-rose-600"><LogOut className="h-3.5 w-3.5" />{t.logout}</button>
                  </form>
                </div>
              }
              t={t}
            />
          )}
          <div className="min-w-0 flex-1">
            <header className={`border-b border-slate-200/70 bg-white ${showNav ? "lg:hidden" : ""}`}>
              <div className="flex items-center gap-3 px-4 py-3">
                {showNav && <MobileNav items={nav} account={account} t={t} />}
                {logo}
                <div className="ml-auto flex items-center gap-3">
                  {langSwitch}
                  {showNav && (
                    <form action={logoutAction}><button className="text-slate-500 hover:text-rose-600" aria-label={t.logout}><LogOut className="h-5 w-5" /></button></form>
                  )}
                </div>
              </div>
            </header>
            {inDemo && (
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-amber-100 px-4 py-2 text-center text-xs font-semibold text-amber-900" data-testid="demo-bar">
                <span className="flex items-center gap-2"><FlaskConical className="h-4 w-4 shrink-0" /> {t.demoBar}</span>
                {user?.isAdmin && (
                  <ActionForm action={resetDemoAction}>
                    <ConfirmButton message={t.demoResetConfirm} className="rounded-lg bg-white/70 px-2.5 py-1 text-amber-900 ring-1 ring-amber-300 hover:bg-white" confirmLabel={t.demoReset}>{t.demoReset}</ConfirmButton>
                  </ActionForm>
                )}
                <form action={leaveDemoAction}><button className="rounded-lg bg-amber-900 px-2.5 py-1 text-white hover:bg-amber-800">{t.demoLeave}</button></form>
              </div>
            )}
            {process.env.SEED_DEMO === "true" && (
              <div className="flex items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-center text-xs font-medium text-amber-900">
                <FlaskConical className="h-4 w-4 shrink-0" /> {t.demoBanner}
              </div>
            )}
            <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
            <ConnectionBanner retryLabel={t.retry} />
            <BackToTop label={t.backToTop} />
            <Toasts />
          </div>
        </div>
      </body>
    </html>
  );
}
