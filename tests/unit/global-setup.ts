import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { rmSync } from "node:fs";

export default async function setup() {
  // The real database and the demo's (both throw-away files).
  const files = [process.env.TURSO_DATABASE_URL!, process.env.TURSO_DEMO_DATABASE_URL!].map((u) => u.replace(/^file:/, ""));
  const all = files.flatMap((f) => [f, `${f}-shm`, `${f}-wal`]);
  for (const f of all) rmSync(f, { force: true });
  for (const f of files) {
    const client = createClient({ url: `file:${f}` });
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
    client.close();
  }
  return () => {
    for (const f of all) rmSync(f, { force: true });
  };
}
