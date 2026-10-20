import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { rmSync } from "node:fs";

export default async function setup() {
  const url = process.env.TURSO_DATABASE_URL!;
  const file = url.replace(/^file:/, "");
  for (const f of [file, `${file}-shm`, `${file}-wal`]) rmSync(f, { force: true });
  const client = createClient({ url });
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  client.close();
  return () => {
    for (const f of [file, `${file}-shm`, `${file}-wal`]) rmSync(f, { force: true });
  };
}
