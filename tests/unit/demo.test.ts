import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_USERS, seedDemo } from "../../scripts/seed-demo.mjs";

const file = join(tmpdir(), `eys-demo-${process.pid}.db`);
let client: Client;
const env = { DEMO_PASSWORD: "only-for-this-test" };
const count = async (sql: string) => Number((await client.execute(sql)).rows[0].n);

beforeAll(async () => {
  rmSync(file, { force: true });
  client = createClient({ url: `file:${file}` });
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
});
afterAll(() => {
  client.close();
  rmSync(file, { force: true });
});

describe("demo mode", () => {
  it("loads sample people for every role and a sample campaign", async () => {
    await seedDemo(client, env);
    const roles = (await client.execute("SELECT DISTINCT role FROM users")).rows.map((r) => r.role);
    expect(roles.sort()).toEqual(["admin", "agent", "inspector", "supervisor"]);
    expect(await count("SELECT COUNT(*) n FROM users")).toBe(DEMO_USERS.length);
    expect(await count("SELECT COUNT(*) n FROM establishments")).toBeGreaterThan(20);
    expect(await count("SELECT COUNT(*) n FROM companies WHERE assigned_user_id IS NULL")).toBe(0);
    expect(await count("SELECT COUNT(*) n FROM establishments WHERE correo IS NOT NULL AND correo NOT LIKE '%@example.com'")).toBe(0);
  });

  it("reloads the same data on every deployment", async () => {
    await client.execute("INSERT INTO campaigns (name, start_date, end_date) VALUES ('creada por un tester', '2026-01-01', '2026-02-01')");
    await seedDemo(client, env);
    // The demo campaign plus a closed past one (for the «otras campañas» warnings); anything else is wiped.
    expect(await count("SELECT COUNT(*) n FROM campaigns")).toBe(2);
    expect(await count("SELECT COUNT(*) n FROM campaigns WHERE name = 'creada por un tester'")).toBe(0);
  });

  it("refuses to run on the live site", async () => {
    await expect(seedDemo(client, { ...env, VERCEL_ENV: "production" })).rejects.toThrow(/live/);
  });

  it("refuses without a demo password", async () => {
    await expect(seedDemo(client, {})).rejects.toThrow(/DEMO_PASSWORD/);
  });

  it("never touches a database with real data", async () => {
    await client.execute("DELETE FROM app_meta");
    await expect(seedDemo(client, env)).rejects.toThrow(/not marked as a demo database/);
    expect(await count("SELECT COUNT(*) n FROM users")).toBe(DEMO_USERS.length); // nothing was deleted
  });
});
