// Applies pending migrations and creates the first admin user if the users table is empty.
// Runs automatically before `next build` (and therefore on every Vercel deploy).
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import bcrypt from "bcryptjs";
import fs from "node:fs";

if (fs.existsSync(".env.local")) process.loadEnvFile?.(".env.local");
else if (fs.existsSync(".env")) process.loadEnvFile?.(".env");

const url = process.env.TURSO_DATABASE_URL ?? "file:local.db";
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const db = drizzle(client);

await migrate(db, { migrationsFolder: "./drizzle" });
console.log(`[migrate] migrations applied to ${url.replace(/\?.*$/, "")}`);

const { rows } = await client.execute("SELECT COUNT(*) AS n FROM users");
if (Number(rows[0].n) === 0) {
  const username = (process.env.ADMIN_USERNAME ?? "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!username || password.length < 8) {
    console.warn("[migrate] no users yet: set ADMIN_USERNAME and ADMIN_PASSWORD (8+ chars) to create the first admin");
  } else {
    const hash = await bcrypt.hash(password, 10);
    await client.execute({
      sql: "INSERT INTO users (username, name, role, password_hash, must_change_password) VALUES (?, ?, 'admin', ?, 1)",
      args: [username, process.env.ADMIN_NAME ?? "Administrador", hash],
    });
    console.log(`[migrate] created admin user "${username}"`);
  }
}
client.close();
