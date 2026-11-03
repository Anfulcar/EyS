import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db, demoClient, demoConfigured, isDemoRequest, realDb } from "@/db";
import { campaigns, users } from "@/db/schema";
import { checkDemoPassword, DEMO_ENTRIES, demoOpen, demoSettings, resetDemo, saveDemoSettings } from "@/lib/demo";
import { DEMO_HOURS, demoToken, validDemoToken } from "@/lib/demo-token";

describe("«Demo» inside the app", () => {
  it("the demo pass is signed by the server and expires", () => {
    const now = Date.now();
    const tok = demoToken(now);
    expect(validDemoToken(tok, now)).toBe(true);
    expect(validDemoToken(tok, now + (DEMO_HOURS + 1) * 3600_000)).toBe(false);
    const [exp] = tok.split(".");
    expect(validDemoToken(`${Number(exp) + 1000}.${tok.split(".")[1]}`, now)).toBe(false);
    expect(validDemoToken("made.up", now)).toBe(false);
    expect(validDemoToken(undefined, now)).toBe(false);
  });

  it("outside a demo visit everything uses the real database", () => {
    expect(demoConfigured).toBe(true);
    expect(isDemoRequest()).toBe(false);
  });

  it("is closed until switched on with a password; wrong passwords lock for 15 minutes", async () => {
    expect(await demoOpen()).toBe(false);
    await saveDemoSettings(true, "demo-para-capacitar");
    expect(await demoOpen()).toBe(true);
    expect((await demoSettings()).hash).not.toContain("demo-para-capacitar");
    expect(await checkDemoPassword("demo-para-capacitar", "10.0.0.1")).toBe("ok");
    for (let i = 0; i < 4; i++) expect(await checkDemoPassword("otra", "10.0.0.2")).toBe("wrong");
    expect(await checkDemoPassword("otra", "10.0.0.2")).toBe("locked");
    // Even the right password waits while locked; another place is not affected.
    expect(await checkDemoPassword("demo-para-capacitar", "10.0.0.2")).toBe("locked");
    expect(await checkDemoPassword("demo-para-capacitar", "10.0.0.3")).toBe("ok");
    await saveDemoSettings(false, null);
    expect(await demoOpen()).toBe(false);
    expect(await checkDemoPassword("demo-para-capacitar", "10.0.0.1")).toBe("wrong");
  });

  it("«Reiniciar demo» fills only the demo database, with a person for every entry button", async () => {
    const realCampaignsBefore = (await realDb.select().from(campaigns)).length;
    await resetDemo("Tester");
    const names = (await demoClient().execute("SELECT username FROM users")).rows.map((r) => String(r.username));
    for (const e of DEMO_ENTRIES) expect(names).toContain(e.username);
    expect(Number((await demoClient().execute("SELECT COUNT(*) AS n FROM campaigns")).rows[0].n)).toBeGreaterThan(0);
    // The real database is untouched, and outside the demo the app keeps reading it.
    expect((await realDb.select().from(campaigns)).length).toBe(realCampaignsBefore);
    expect(await db.select().from(users).where(eq(users.username, "demo.admin"))).toEqual([]);
    expect((await demoSettings()).resetBy).toBe("Tester");
    // Every demo person has a profile.
    expect(Number((await demoClient().execute("SELECT COUNT(*) AS n FROM users WHERE profile_id IS NULL")).rows[0].n)).toBe(0);
  });
});
