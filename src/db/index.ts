import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const url = process.env.TURSO_DATABASE_URL ?? "file:local.db";
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
// Local file databases (tests, local checks): wait for a moment instead of failing when background
// work (log, SIGTUR queue) writes at the same time as a request.
if (url.startsWith("file:")) client.execute("PRAGMA busy_timeout = 5000").catch(() => {});

export const db = drizzle(client, { schema });
export { schema };
