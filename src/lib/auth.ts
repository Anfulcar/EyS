import "server-only";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users, type User } from "@/db/schema";
import { readSession, SESSION_COOKIE, SESSION_HOURS, signSession } from "./session";

export type Role = "admin" | "supervisor" | "agent" | "inspector";

export async function setSessionCookie(user: User) {
  const token = await signSession({ uid: user.id, role: user.role, name: user.name, mcp: user.mustChangePassword });
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
export async function currentUser(): Promise<User | null> {
  const s = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!s) return null;
  const u = await db.query.users.findFirst({ where: eq(users.id, s.uid) });
  if (!u || !u.active) return null;
  return u;
}

export async function requireUser(roles?: Role[]): Promise<User> {
  const u = await currentUser();
  if (!u) redirect("/login");
  if (u.mustChangePassword) redirect("/account?force=1");
  if (roles && !roles.includes(u.role as Role)) redirect("/");
  return u;
}

// For server actions / route handlers: throws instead of redirecting.
export async function assertUser(roles?: Role[]): Promise<User> {
  const u = await currentUser();
  if (!u || u.mustChangePassword) throw new Error("Unauthorized");
  if (roles && !roles.includes(u.role as Role)) throw new Error("Forbidden");
  return u;
}

export const MANAGERS: Role[] = ["admin", "supervisor"];

export function homeFor(role: string) {
  if (role === "agent") return "/calls";
  if (role === "inspector") return "/visits";
  return "/campaigns";
}
