import "server-only";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { users, type User } from "@/db/schema";
import { isRecentAuth, readSession, SESSION_COOKIE, SESSION_HOURS, signSession } from "./session";

export type Role = "admin" | "supervisor" | "agent" | "inspector";

// Call only right after the person typed their password: it restarts the "recent sign-in" clock.
export async function setSessionCookie(user: User) {
  const token = await signSession({ uid: user.id, role: user.role, name: user.name, mcp: user.mustChangePassword, authAt: Date.now() });
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

// Loads the current user from the database on every request, so deactivation and role changes apply immediately.
// Read once per request: the menu and the page share the same lookup.
export const currentUser = cache(async (): Promise<User | null> => {
  const s = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!s) return null;
  const u = await db.query.users.findFirst({ where: eq(users.id, s.uid) });
  if (!u || !u.active) return null;
  return u;
});

export async function requireUser(roles?: Role[]): Promise<User> {
  const u = await currentUser();
  if (!u) redirect("/login");
  if (u.mustChangePassword) redirect("/account?force=1");
  // A screen a role may not use answers "not found" (it doesn't reveal that it exists).
  if (roles && !roles.includes(u.role as Role)) notFound();
  return u;
}

// For server actions / route handlers: throws instead of redirecting.
export async function assertUser(roles?: Role[]): Promise<User> {
  const u = await currentUser();
  if (!u || u.mustChangePassword) throw new Error("Not found");
  if (roles && !roles.includes(u.role as Role)) throw new Error("Not found");
  return u;
}

// For downloads (route handlers): the user if allowed, otherwise null → answer with notFoundResponse().
export async function routeUser(roles?: Role[]): Promise<User | null> {
  const u = await currentUser();
  if (!u || u.mustChangePassword) return null;
  if (roles && !roles.includes(u.role as Role)) return null;
  return u;
}

export function notFoundResponse() {
  return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

export const MANAGERS: Role[] = ["admin", "supervisor"];

export function homeFor(role: string) {
  if (role === "agent") return "/calls";
  if (role === "inspector") return "/visits";
  return "/campaigns";
}

// True when the person typed their password within the last few minutes (see REAUTH_MINUTES, default 10).
export async function recentlyAuthenticated() {
  const s = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  return isRecentAuth(s?.authAt);
}
