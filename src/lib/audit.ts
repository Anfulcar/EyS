import "server-only";
import { headers } from "next/headers";
import { db } from "@/db";
import { activityLog, errorLog } from "@/db/schema";

type Actor = { id: number; name: string } | null;

// Action names shown (translated) on the "Registro" screen.
export const ACTIONS = [
  "login.success", "login.failed", "login.locked", "login.reauth", "logout", "password.changed",
  "user.created", "user.updated", "user.role_changed", "user.status_changed", "user.password_reset",
  "campaign.created", "campaign.updated", "campaign.status_changed", "campaign.deleted",
  "upload.establishments", "upload.bounces", "upload.status", "emails.marked_sent",
  "assignment.run", "task.reassigned", "call.logged", "phone.added", "visit.logged",
  "export.downloaded",
] as const;
export type ActivityAction = (typeof ACTIONS)[number];

async function clientIp() {
  try {
    const h = await headers();
    return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
  } catch {
    return null;
  }
}

// Recording must never break the action being recorded, so failures are swallowed.
export async function logActivity(
  actor: Actor,
  action: ActivityAction,
  info: { campaignId?: number | null; entity?: string; entityId?: string | number | null; summary?: string } = {},
) {
  try {
    await db.insert(activityLog).values({
      userId: actor?.id ?? null,
      userName: actor?.name ?? null,
      action,
      campaignId: info.campaignId ?? null,
      entity: info.entity ?? null,
      entityId: info.entityId != null ? String(info.entityId) : null,
      summary: info.summary?.slice(0, 500) ?? null,
      ip: await clientIp(),
    });
  } catch (e) {
    console.error("[activity-log] could not record", action, e);
  }
}

export async function logError(source: "server" | "action" | "browser", message: string, info: { userId?: number | null; path?: string | null; digest?: string | null; detail?: string | null } = {}) {
  try {
    await db.insert(errorLog).values({
      source,
      message: message.slice(0, 1000),
      userId: info.userId ?? null,
      path: info.path?.slice(0, 300) ?? null,
      digest: info.digest ?? null,
      detail: info.detail?.slice(0, 4000) ?? null,
    });
  } catch (e) {
    console.error("[error-log] could not record", e);
  }
}
