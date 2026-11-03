import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { after } from "next/server";
import { cookies } from "next/headers";
import { AsyncLocalStorage } from "node:async_hooks";
import { validDemoToken, DEMO_COOKIE } from "@/lib/demo-token";
import * as schema from "./schema";

function open(url: string, authToken: string | undefined) {
  const client = createClient({ url, authToken });
  // Local file databases (tests, local checks): wait for a moment instead of failing when background
  // work (log, SIGTUR queue) writes at the same time as a request.
  if (url.startsWith("file:")) client.execute("PRAGMA busy_timeout = 5000").catch(() => {});
  return { client, db: drizzle(client, { schema }) };
}

const real = open(process.env.TURSO_DATABASE_URL ?? "file:local.db", process.env.TURSO_AUTH_TOKEN);

// «Demo» inside the app: a second, separate database with made-up data. A request is a demo request only
// when it carries a valid demo pass (cookie signed by the server); everything else uses the real database.
export const demoConfigured = !!process.env.TURSO_DEMO_DATABASE_URL;
let demo: ReturnType<typeof open> | null = null;
export function demoClient() {
  if (!demoConfigured) throw new Error("Demo database not configured");
  demo ??= open(process.env.TURSO_DEMO_DATABASE_URL!, process.env.TURSO_DEMO_AUTH_TOKEN);
  return demo.client;
}

// Work started after the answer is sent keeps the database of the request that started it.
const scope = new AsyncLocalStorage<{ demo: boolean }>();

export function isDemoRequest(): boolean {
  const s = scope.getStore();
  if (s) return s.demo;
  if (!demoConfigured) return false;
  try {
    // Read synchronously: every database call needs the answer at once. Outside a request (scripts,
    // tests, background) there are no cookies and the real database is used.
    const jar = cookies() as unknown as { get(name: string): { value: string } | undefined };
    return validDemoToken(jar.get(DEMO_COOKIE)?.value);
  } catch (e) {
    // Next.js's own signals (e.g. "this page must be rendered per request") must reach Next.js.
    if (e && typeof e === "object" && "digest" in e) throw e;
    return false;
  }
}

function active() {
  if (!isDemoRequest()) return real.db;
  demoClient();
  return demo!.db;
}

// The database of the current request (real, or the demo's when inside the demo).
export const db = new Proxy(real.db, {
  get(_, prop) {
    const target = active();
    const v = Reflect.get(target, prop, target);
    return typeof v === "function" ? v.bind(target) : v;
  },
}) as typeof real.db;

// Always the real database (demo settings and the demo password live here).
export const realDb = real.db;

// Like after(): runs once the answer is sent, on the same database as the request that scheduled it.
export function afterResponse(fn: () => unknown) {
  const demoReq = isDemoRequest();
  after(() => scope.run({ demo: demoReq }, fn));
}

// Runs fn on the real database even while a demo pass is present (signing in to the real app).
export function onReal<T>(fn: () => Promise<T>) {
  return scope.run({ demo: false }, fn);
}

export { schema };
