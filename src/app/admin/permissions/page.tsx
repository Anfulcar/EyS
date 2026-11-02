import { asc } from "drizzle-orm";
import Link from "next/link";
import { AdminTabs } from "@/components/AdminTabs";
import { AssignProfiles } from "@/components/AssignProfiles";
import { ProfilesView, type ProfilesText } from "@/components/ProfilesView";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n-server";
import { listProfiles } from "@/lib/permissions";
import { ACTIONS, ACTION_IDS, ADMIN_KEY, parseActions } from "@/lib/permissions-core.mjs";
import { ACTION_TEXT, menuFor, type MenuLabels } from "@/lib/permissions-text";
import { QR_TEXT } from "@/lib/qr-i18n";
import { assignProfilesAction, createProfileAction, deleteProfileAction, saveProfileAction } from "../../actions";

const VIEWS = ["profiles", "assign", "compare"] as const;

// «Administración general → Permisos»: permission profiles (only the Administrador profile gets here).
export default async function PermissionsPage({ searchParams }: { searchParams: Promise<{ view?: string; p?: string }> }) {
  const me = await requireUser("g.perms");
  const sp = await searchParams;
  const view = (VIEWS as readonly string[]).includes(sp.view ?? "") ? sp.view! : "profiles";
  const { t, lang } = await getDict();
  const qt = QR_TEXT[lang];
  const [rows, people] = await Promise.all([listProfiles(), db.select().from(users).orderBy(asc(users.name))]);
  const profiles = rows.map((p) => {
    const isAdmin = p.key === ADMIN_KEY;
    return { id: p.id, name: p.name, description: p.description ?? "", actions: isAdmin ? [...ACTION_IDS] : parseActions(p.actions), isAdmin, people: people.filter((u) => u.profileId === p.id).map((u) => u.name) };
  });
  const text = ACTION_TEXT[lang];
  const groups = { calls: t.navGroupCalls, qr: qt.module, general: t.navGroupGeneral };
  const modules = (["c", "q", "g"] as const).map((m) => ({
    id: m,
    title: groups[m === "c" ? "calls" : m === "q" ? "qr" : "general"],
    actions: ACTIONS.filter((a) => a.mod === m).map((a) => ({ id: a.id, label: text[a.id][0], help: text[a.id][1], req: a.req, adminOnly: a.adminOnly })),
  }));
  const menuLabels: MenuLabels = {
    calls: t.navCalls, reviews: t.navReviews, campaigns: t.navCampaigns, visits: t.navVisits, stats: t.navStats, reports: t.navReports, callsSettings: t.navCallsSettings,
    cases: qt.navCases, publicForm: qt.navPublicForm, qrStats: qt.tabStats, qrSettings: qt.navModuleSettings, admin: t.navAdmin, help: t.navHelp,
  };
  const selected = profiles.some((p) => p.id === Number(sp.p)) ? Number(sp.p) : (profiles.find((p) => !p.isAdmin) ?? profiles[0])?.id;
  const pt: ProfilesText = {
    permActionsOf: t.permActionsOf, permNew: t.permNew, permName: t.permName, permDesc: t.permDesc, permLocked: t.permLocked, permMarkAll: t.permMarkAll,
    permClearAll: t.permClearAll, permNeeds: t.permNeeds, permAdminOnly: t.permAdminOnly, permMenuPreview: t.permMenuPreview, permPeopleWith: t.permPeopleWith,
    permNobody: t.permNobody, permDuplicate: t.permDuplicate, permDeleteHint: t.permDeleteHint, permDeleteConfirm: t.permDeleteConfirm, permDiscard: t.permDiscard,
    permAffectsOne: t.permAffectsOne, permAffectsMany: t.permAffectsMany, permAlsoTicked: t.permAlsoTicked, permAlsoUnticked: t.permAlsoUnticked,
    permUnsaved: t.permUnsaved, permPasswordNote: t.permPasswordNote, delete: t.delete, save: t.save, discardConfirm: t.permDiscardConfirm,
  };
  const tabs: [string, string][] = [["profiles", t.permViewProfiles], ["assign", t.permViewAssign], ["compare", t.permViewCompare]];

  return (
    <div className="space-y-6">
      <AdminTabs t={t} me={me} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2>{t.permTitle}</h2>
          <p className="subtitle max-w-3xl">{t.permHelp}</p>
        </div>
        <nav className="segmented" aria-label={t.permTitle}>
          {tabs.map(([k, l]) => <Link key={k} href={k === "profiles" ? "/admin/permissions" : `/admin/permissions?view=${k}`} aria-current={view === k ? "page" : undefined}>{l}</Link>)}
        </nav>
      </div>

      {view === "profiles" && selected && (
        <ProfilesView key={selected} profiles={profiles} selected={selected} modules={modules} total={ACTION_IDS.length} menuLabels={menuLabels} groups={groups}
          t={pt} save={saveProfileAction} create={createProfileAction} remove={deleteProfileAction} />
      )}

      {view === "assign" && (
        <AssignProfiles
          people={people.map((u) => ({ id: u.id, name: u.name, username: u.username, active: u.active, profileId: u.profileId, self: u.id === me.id }))}
          profiles={profiles.map((p) => ({ id: p.id, name: p.name }))}
          modulesOf={Object.fromEntries(profiles.map((p) => [p.id, menuFor(p.actions, menuLabels, groups).filter(([g]) => g !== groups.general || p.actions.some((a) => a.startsWith("g."))).map(([g]) => g).join(" · ")]))}
          t={{ name: t.name, profile: t.profile, modules: t.permModulesUsed, save: t.save, hint: t.permNewPeopleHint, you: t.permYou, inactive: t.inactive, none: "—" }}
          action={assignProfilesAction}
        />
      )}

      {view === "compare" && (
        <div className="space-y-3">
          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="table" data-testid="compare-profiles">
                <thead><tr><th>{t.permAction}</th>{profiles.map((p) => <th key={p.id} className="text-center">{p.name}</th>)}</tr></thead>
                <tbody>
                  {modules.map((m) => [
                    <tr key={m.id}><td colSpan={profiles.length + 1} className="bg-slate-50 font-semibold text-slate-900">{m.title}</td></tr>,
                    ...m.actions.map((a) => (
                      <tr key={a.id}>
                        <td className="min-w-[14rem] text-sm">{a.label}</td>
                        {profiles.map((p) => p.actions.includes(a.id)
                          ? <td key={p.id} className="text-center font-bold text-emerald-600" aria-label={t.yes}>✓</td>
                          : <td key={p.id} className="text-center text-slate-300" aria-label={t.no}>—</td>)}
                      </tr>
                    )),
                  ])}
                </tbody>
              </table>
            </div>
          </div>
          <a href="/api/admin/profiles" className="btn-secondary btn-sm" download>⬇ {t.exportDownloadXlsx}</a>
        </div>
      )}
    </div>
  );
}
