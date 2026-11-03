import "server-only";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { db, isDemoRequest } from "@/db";
import { users, type User } from "@/db/schema";
import { can, canAny, profileOf, type Who } from "./permissions";
import { isRecentAuth, readSession, SESSION_COOKIE, SESSION_HOURS, signSession } from "./session";


// Call only right after the person typed their password: it restarts the "recent sign-in" clock.
export async function setSessionCookie(user: User) {
  const token = await signSession({ uid: user.id, role: user.role, name: user.name, mcp: user.mustChangePassword, authAt: Date.now(), demo: isDemoRequest() });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export type Me = User & { actions: string[]; profileName: string; isAdmin: boolean };

// Loads the current user (and their permission profile) from the database on every request, so deactivation
// and profile changes apply immediately. Read once per request: the menu and the page share the same lookup.
export const currentUser = cache(async (): Promise<Me | null> => {
  const s = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!s) return null;
  // A demo sign-in only counts inside the demo, and a real one only outside it (the two databases have
  // different people under the same numbers).
  if (!!s.demo !== isDemoRequest()) return null;
  const u = await db.query.users.findFirst({ where: eq(users.id, s.uid) });
  if (!u || !u.active) return null;
  const p = await profileOf(u);
  return { ...u, actions: p.actions, profileName: p.name, isAdmin: p.isAdmin };
});

// What a screen, action or download needs: one action id, or a list where any one of them is enough.
export type Need = string | readonly string[];
export function mayUse(u: Who, need: Need) {
  return typeof need === "string" ? can(u, need) : canAny(u, need);
}

export async function requireUser(need?: Need): Promise<Me> {
  const u = await currentUser();
  if (!u) redirect("/login");
  if (u.mustChangePassword) redirect("/account?force=1");
  // A screen the person's profile doesn't allow answers "not found" (it doesn't reveal that it exists).
  if (need && !mayUse(u, need)) notFound();
  return u;
}

// For server actions / route handlers: throws instead of redirecting.
export async function assertUser(need?: Need): Promise<Me> {
  const u = await currentUser();
  if (!u || u.mustChangePassword) throw new Error("Not found");
  if (need && !mayUse(u, need)) throw new Error("Not found");
  return u;
}

// For downloads (route handlers): the user if allowed, otherwise null → answer with notFoundResponse().
export async function routeUser(need?: Need): Promise<Me | null> {
  const u = await currentUser();
  if (!u || u.mustChangePassword) return null;
  if (need && !mayUse(u, need)) return null;
  return u;
}

export function notFoundResponse() {
  return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

// Whether the person uses the call campaigns at all (any of its actions).
export const CALL_ACTIONS = ["c.call", "c.own", "c.review", "c.view", "c.visits"] as const;
export const hasCalls = (u: Who) => canAny(u, CALL_ACTIONS);
// «Administración general» (any of its tabs).
export const ADMIN_ACTIONS = ["g.people", "g.perms", "g.sigtur", "g.log"] as const;

// First screen after signing in: the most useful one the profile allows.
export function homeFor(u: Who & { actions: readonly string[] }) {
  if (can(u, "c.view")) return "/campaigns";
  if (can(u, "c.call")) return "/calls";
  if (can(u, "c.visits")) return "/visits";
  if (can(u, "q.register")) return "/quejas";
  if (can(u, "c.own")) return "/reviews";
  if (can(u, "g.people")) return "/users";
  return "/help";
}

// True when the person typed their password within the last few minutes (see REAUTH_MINUTES, default 10).
export async function recentlyAuthenticated(minutes?: number) {
  const s = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  return isRecentAuth(s?.authAt, Date.now(), minutes);
}
