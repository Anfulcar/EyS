import { desc } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { activityLog, errorLog } from "@/db/schema";
import { logActivity, logError } from "@/lib/audit";
import { activityRows } from "@/lib/logs";

describe("activity and error log", () => {
  it("records who did what", async () => {
    await logActivity({ id: 7, name: "Ana Agente" }, "call.logged", { campaignId: 1, entity: "task", entityId: 42, summary: "RUT:TA-1 · resultado: 01" });
    const [row] = await db.select().from(activityLog).orderBy(desc(activityLog.id)).limit(1);
    expect(row).toMatchObject({ userId: 7, userName: "Ana Agente", action: "call.logged", entityId: "42" });
    expect(row.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("filters by action and text", async () => {
    await logActivity(null, "login.failed", { summary: "Usuario: nadie" });
    expect((await activityRows({ action: "login.failed" }, 10)).every((r) => r.action === "login.failed")).toBe(true);
    expect(await activityRows({ q: "TA-1" }, 10)).toHaveLength(1);
    // Several actions at once.
    const both = await activityRows({ action: "login.failed|call.logged" }, 10);
    expect(new Set(both.map((r) => r.action))).toEqual(new Set(["login.failed", "call.logged"]));
  });

  it("records errors", async () => {
    await logError("server", "Boom", { path: "/calls/1", digest: "abc" });
    const [row] = await db.select().from(errorLog).orderBy(desc(errorLog.id)).limit(1);
    expect(row).toMatchObject({ source: "server", message: "Boom", path: "/calls/1" });
  });
});
