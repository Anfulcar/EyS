import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { permissionProfiles, users, type User } from "@/db/schema";
import { hasCalls, homeFor, mayUse } from "@/lib/auth";
import { can, grantable, manualKinds, withActions } from "@/lib/permissions";
import { ACTION_IDS, ensureProfiles, legacyActions, parseActions, STANDARD_PROFILES, withoutDependents, withRequirements } from "@/lib/permissions-core.mjs";
import { ACTION_TEXT, menuFor, type MenuLabels } from "@/lib/permissions-text";

const u = (role: string, callsAccess: boolean, qrLevel = "none") => ({ role, callsAccess, qrLevel }) as User;
const withActs = (actions: string[]) => ({ ...u("agent", true), actions });

describe("permission profiles: actions", () => {
  it("every action has a name and an explanation in both languages", () => {
    for (const id of ACTION_IDS) {
      expect(ACTION_TEXT.es[id]?.[0]).toBeTruthy();
      expect(ACTION_TEXT.en[id]?.[0]).toBeTruthy();
    }
  });
  it("ticking adds what an action needs; unticking removes what depends on it; admin-only actions are never added", () => {
    expect(withRequirements(["q.workAny"]).sort()).toEqual(["q.register", "q.seeAll", "q.workAny", "q.workMine"].sort());
    expect(withRequirements(["c.remove"]).sort()).toEqual(["c.edit", "c.remove", "c.view"].sort());
    expect(withoutDependents(["q.register", "q.seeAll", "q.workMine", "q.workAny", "q.stats"], "q.seeAll").sort()).toEqual(["q.register", "q.workMine"]);
    expect(withRequirements(["g.perms", "made.up"])).toEqual([]);
  });
});

describe("permission profiles: day one copies the old roles", () => {
  it("the old roles map to the same access as before", () => {
    expect(legacyActions("admin", false, "none")).toEqual(ACTION_IDS);
    // Supervisors: everything in calls except creating/closing campaigns and removing RUTs (that was administrators only).
    const sup = legacyActions("supervisor", true, "none");
    expect(sup).toContain("c.assign");
    expect(sup).not.toContain("c.edit");
    expect(sup).not.toContain("c.remove");
    expect(legacyActions("agent", true, "none")).toEqual(["c.call", "c.own"]);
    expect(legacyActions("inspector", true, "none")).toEqual(["c.visits"]);
    // Without «Campañas de llamadas» nothing in calls; «Gestor de quejas» never uses calls.
    expect(legacyActions("agent", false, "register")).toEqual(["q.register"]);
    expect(legacyActions("complaints", true, "manage").some((a) => a.startsWith("c."))).toBe(false);
  });
  it("people without a profile keep their old screens and first page", () => {
    expect(mayUse(u("agent", true), "c.call")).toBe(true);
    expect(mayUse(u("agent", false), "c.call")).toBe(false);
    expect(mayUse(u("supervisor", false), ["c.view"])).toBe(false);
    expect(mayUse(u("admin", false), "g.perms")).toBe(true);
    expect(mayUse(u("inspector", true), "g.people")).toBe(false);
    expect(hasCalls(u("admin", false))).toBe(true);
    expect(hasCalls(u("complaints", true))).toBe(false);
    expect(homeFor(u("agent", false))).toBe("/help");
    expect(homeFor(u("agent", false, "manage"))).toBe("/quejas");
    expect(homeFor(u("complaints", true, "manage"))).toBe("/quejas");
    expect(homeFor(u("agent", true))).toBe("/calls");
    expect(homeFor(u("inspector", true))).toBe("/visits");
    expect(homeFor(u("admin", false))).toBe("/campaigns");
  });
  it("the profile wins over the old role", () => {
    const p = withActs(["q.register"]);
    expect(can(p, "c.call")).toBe(false);
    expect(homeFor(p)).toBe("/quejas");
    expect(manualKinds(withActs(["c.visits", "q.register"]))).toEqual(["inspector", "complaints"]);
  });
});

describe("permission profiles: the deploy step", () => {
  it("creates the day-one profiles once and gives everyone the profile matching their old access", async () => {
    const mk = async (username: string, role: string, callsAccess: boolean, qrLevel: string) =>
      (await db.insert(users).values({ username, name: username, role, passwordHash: "x", callsAccess, qrLevel }).returning())[0];
    const a = await mk("pp.admin", "admin", true, "none");
    const s = await mk("pp.sup", "supervisor", true, "supervise");
    const g = await mk("pp.agent", "agent", true, "register");
    const odd = await mk("pp.odd", "inspector", true, "manage");
    const client = createClient({ url: process.env.TURSO_DATABASE_URL! });
    const first = await ensureProfiles(client);
    expect(first.assigned).toBeGreaterThanOrEqual(4);
    const again = await ensureProfiles(client);
    expect(again).toEqual({ created: 0, assigned: 0 });
    client.close();
    const profiles = await db.select().from(permissionProfiles);
    for (const sp of STANDARD_PROFILES) expect(profiles.some((p) => p.key === sp.key)).toBe(true);
    const [ra, rs, rg, ro] = await withActions(await Promise.all([a, s, g, odd].map(async (x) => (await db.select().from(users).where(eq(users.id, x.id)))[0])));
    expect(ra.isAdmin).toBe(true);
    expect(rs.profileName).toBe("Supervisor");
    expect(rg.profileName).toBe("Agente · registra quejas");
    // An unusual combination gets its own profile with exactly the old access.
    expect(ro.profileName).toBe("Inspector · gestiona quejas");
    expect([...ro.actions].sort()).toEqual([...legacyActions("inspector", true, "manage")].sort());
  });
  it("nobody hands out more than they can do; the Administrador profile gives any", async () => {
    const profiles = await db.select().from(permissionProfiles);
    const supActions = parseActions(profiles.find((p) => p.key === "supervisor")!.actions);
    const fromSup = grantable({ isAdmin: false, actions: supActions }, profiles);
    expect(fromSup.some((p) => p.key === "admin")).toBe(false);
    expect(fromSup.some((p) => p.key === "agent")).toBe(true);
    expect(grantable({ isAdmin: true, actions: [] }, profiles).length).toBe(profiles.length);
  });
});

describe("permission profiles: the menu preview", () => {
  it("shows only what the actions open", () => {
    const l = Object.fromEntries(["calls", "reviews", "campaigns", "visits", "stats", "reports", "callsSettings", "cases", "publicForm", "qrStats", "qrSettings", "admin", "help"].map((k) => [k, k])) as MenuLabels;
    const g = { calls: "C", qr: "Q", general: "G" };
    expect(menuFor(["q.register"], l, g)).toEqual([["Q", ["cases", "publicForm"]], ["G", ["help"]]]);
    expect(menuFor(["c.view", "c.changes"], l, g)[0]).toEqual(["C", ["campaigns", "reports"]]);
  });
});
