import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { permissionProfiles, users, type User } from "@/db/schema";
import { ACTION_IDS, ADMIN_KEY, legacyActions, parseActions } from "./permissions-core.mjs";

// «Perfiles de permisos»: every check in the app asks "may this person do X?" (an action id from
// src/lib/permissions-core.mjs). The answer comes from the person's profile; people without a profile yet
// (before the first deploy step ran) keep exactly what their old role allowed.

export type Who = Pick<User, "role" | "callsAccess" | "qrLevel"> & { actions?: readonly string[] };

export function actionsOf(u: Who): readonly string[] {
  return u.actions ?? legacyActions(u.role, u.callsAccess, u.qrLevel);
}

export const can = (u: Who | null | undefined, action: string) => !!u && actionsOf(u).includes(action);
export const canAny = (u: Who | null | undefined, list: readonly string[]) => !!u && list.some((a) => actionsOf(u).includes(a));

export type ProfileInfo = { id: number | null; name: string; actions: string[]; isAdmin: boolean };

function infoOf(p: { id: number; key: string | null; name: string; actions: string } | undefined, u: Pick<User, "role" | "callsAccess" | "qrLevel">): ProfileInfo {
  if (!p) {
    const isAdmin = u.role === "admin";
    return { id: null, name: "", actions: legacyActions(u.role, u.callsAccess, u.qrLevel), isAdmin };
  }
  const isAdmin = p.key === ADMIN_KEY;
  // The Administrador profile always has every action, including ones added later.
  return { id: p.id, name: p.name, actions: isAdmin ? [...ACTION_IDS] : parseActions(p.actions), isAdmin };
}

export async function profileOf(u: Pick<User, "profileId" | "role" | "callsAccess" | "qrLevel">): Promise<ProfileInfo> {
  const p = u.profileId ? await db.query.permissionProfiles.findFirst({ where: eq(permissionProfiles.id, u.profileId) }) : undefined;
  return infoOf(p, u);
}

// Several people at once (lists of who can be assigned, etc.).
export async function withActions<T extends Pick<User, "profileId" | "role" | "callsAccess" | "qrLevel">>(list: T[]): Promise<(T & { actions: string[]; profileName: string; isAdmin: boolean })[]> {
  const ids = [...new Set(list.map((u) => u.profileId).filter((x): x is number => !!x))];
  const profiles = ids.length ? await db.select().from(permissionProfiles).where(inArray(permissionProfiles.id, ids)) : [];
  const byId = new Map(profiles.map((p) => [p.id, p]));
  return list.map((u) => {
    const i = infoOf(u.profileId ? byId.get(u.profileId) : undefined, u);
    return { ...u, actions: i.actions, profileName: i.name, isAdmin: i.isAdmin };
  });
}

// Active people allowed an action, by name (for "assign to" lists).
export async function peopleWho(action: string) {
  const list = await withActions(await db.select().from(users).where(eq(users.active, true)).orderBy(asc(users.name)));
  return list.filter((u) => u.actions.includes(action));
}

export async function listProfiles() {
  return db.select().from(permissionProfiles).orderBy(asc(permissionProfiles.id));
}

// Ids of the people allowed an action (for database filters). activeOnly = false includes deactivated people
// (lists of past work).
export async function idsWho(action: string, activeOnly = true) {
  const rows = await db.select().from(users).where(activeOnly ? eq(users.active, true) : undefined);
  return (await withActions(rows)).filter((u) => u.actions.includes(action)).map((u) => u.id);
}

// Which parts of the manual («Ayuda») apply: the manual is written per kind of work.
export function manualKinds(u: Who) {
  const k: string[] = [];
  if (canAny(u, ["g.people", "g.perms", "g.sigtur", "g.log", "c.edit", "c.remove"])) k.push("admin");
  if (can(u, "c.view")) k.push("supervisor");
  if (canAny(u, ["c.call", "c.own"])) k.push("agent");
  if (can(u, "c.visits")) k.push("inspector");
  if (can(u, "q.register")) k.push("complaints");
  return k;
}

// Profiles a person may give in «Personas»: the Administrador profile gives any; anyone else only profiles that
// don't allow more than they can do themselves (nobody hands out more access than they have).
export function grantable<P extends { key: string | null; actions: string }>(me: { isAdmin: boolean; actions: readonly string[] }, profiles: P[]): P[] {
  if (me.isAdmin) return profiles;
  const mine = new Set(me.actions);
  return profiles.filter((p) => p.key !== ADMIN_KEY && parseActions(p.actions).every((a) => mine.has(a)));
}
