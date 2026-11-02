import "server-only";
import { notFound, redirect } from "next/navigation";
import type { User } from "@/db/schema";
import { currentUser } from "./auth";
import { atLeast, type QrLevel } from "./qr";

// «Quejas y reclamaciones» screens, actions and downloads: the person's level in «Permisos por módulo» is
// checked on the server; anything below it answers "not found".
export async function requireQr(min: QrLevel = "register"): Promise<User> {
  const u = await currentUser();
  if (!u) redirect("/login");
  if (u.mustChangePassword) redirect("/account?force=1");
  if (!atLeast(u, min)) notFound();
  return u;
}

export async function assertQr(min: QrLevel = "register"): Promise<User> {
  const u = await currentUser();
  if (!u || u.mustChangePassword || !atLeast(u, min)) throw new Error("Not found");
  return u;
}

export async function routeQr(min: QrLevel = "register"): Promise<User | null> {
  const u = await currentUser();
  return u && !u.mustChangePassword && atLeast(u, min) ? u : null;
}
