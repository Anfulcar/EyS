import "server-only";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { seedDemo } from "../../scripts/seed-demo.mjs";
import { demoClient, demoConfigured, realDb } from "@/db";
import { appMeta } from "@/db/schema";

// «Demo» inside the app: switched on and given its password in «Administración general → Demo». The settings
// and the failed tries live in the REAL database; the made-up data in the separate demo database.

type DemoSettings = { enabled: boolean; hash: string | null; resetAt: string | null; resetBy: string | null };
const KEY = "demo_settings";
const TRIES = "demo_tries";
export const DEMO_MAX_TRIES = 5;
export const DEMO_LOCK_MINUTES = 15;

// One button per kind of work on the demo's entry screen (demo people from scripts/seed-demo.mjs).
export const DEMO_ENTRIES = [
  { username: "demo.admin", key: "admin" },
  { username: "demo.supervisor", key: "supervisor" },
  { username: "demo.agente1", key: "agent" },
  { username: "demo.inspector", key: "inspector" },
  { username: "demo.quejas", key: "complaints" },
] as const;

async function read<T>(key: string, fallback: T): Promise<T> {
  const [row] = await realDb.select().from(appMeta).where(eq(appMeta.key, key));
  return row ? { ...fallback, ...(JSON.parse(row.value) as T) } : fallback;
}
async function write(key: string, v: unknown) {
  const value = JSON.stringify(v);
  await realDb.insert(appMeta).values({ key, value }).onConflictDoUpdate({ target: appMeta.key, set: { value } });
}

export async function demoSettings(): Promise<DemoSettings> {
  return read<DemoSettings>(KEY, { enabled: false, hash: null, resetAt: null, resetBy: null });
}

// The demo can be entered when the demo database exists, it is switched on and has a password.
export async function demoOpen() {
  if (!demoConfigured) return false;
  const s = await demoSettings();
  return s.enabled && !!s.hash;
}

export async function saveDemoSettings(enabled: boolean, password: string | null) {
  const s = await demoSettings();
  await write(KEY, { ...s, enabled, hash: password ? await bcrypt.hash(password, 10) : s.hash });
}

// Wrong demo passwords: after 5 in a row from the same place, wait 15 minutes.
const placeOf = (ip: string) => createHash("sha256").update(`${process.env.AUTH_SECRET ?? ""}|${ip}`).digest("base64url").slice(0, 16);

export async function checkDemoPassword(password: string, ip: string): Promise<"ok" | "wrong" | "locked"> {
  const s = await demoSettings();
  if (!s.enabled || !s.hash) return "wrong";
  const tries = await read<Record<string, { n: number; until: number }>>(TRIES, {});
  const now = Date.now();
  for (const [k, v] of Object.entries(tries)) if (v.until && v.until < now && v.n >= DEMO_MAX_TRIES) delete tries[k];
  const place = placeOf(ip);
  const mine = tries[place] ?? { n: 0, until: 0 };
  if (mine.n >= DEMO_MAX_TRIES && mine.until > now) return "locked";
  if (await bcrypt.compare(password, s.hash)) {
    delete tries[place];
    await write(TRIES, tries);
    return "ok";
  }
  const n = mine.n >= DEMO_MAX_TRIES ? 1 : mine.n + 1;
  tries[place] = { n, until: n >= DEMO_MAX_TRIES ? now + DEMO_LOCK_MINUTES * 60_000 : 0 };
  await write(TRIES, tries);
  return n >= DEMO_MAX_TRIES ? "locked" : "wrong";
}

// «Reiniciar demo»: reloads all the made-up data (the demo database is brought up to date on every deploy).
export async function resetDemo(byName: string) {
  const client = demoClient();
  // Demo people enter with the buttons; their own password is random and never used.
  const r = await seedDemo(client, { DEMO_PASSWORD: randomBytes(18).toString("base64url") }, { inApp: true });
  const s = await demoSettings();
  await write(KEY, { ...s, resetAt: new Date().toISOString(), resetBy: byName });
  return r;
}
