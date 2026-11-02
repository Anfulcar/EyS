import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { qrCases, type QrCase, type User } from "@/db/schema";
import { currentUser } from "./auth";
import { canSee, canWork, checkUploadToken } from "./qr";

// Who may add proof to a case: whoever works it, or anyone holding the short-lived permission given right after
// creating the case (the person who registered it, or the public form).
export async function uploaderFor(caseId: number, token: string | null): Promise<{ user: User | null; c: QrCase } | null> {
  const [c] = await db.select().from(qrCases).where(eq(qrCases.id, caseId));
  if (!c || c.status === "cerrada") return null;
  if (token && checkUploadToken(token) === caseId) return { user: await currentUser(), c };
  const u = await currentUser();
  if (u && !u.mustChangePassword && canSee(u, c) && canWork(u, c)) return { user: u, c };
  return null;
}
