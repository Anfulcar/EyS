// Starts the already-built app on a fresh, throw-away database for the browser test.
import { spawn, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

for (const f of ["e2e.db", "e2e.db-shm", "e2e.db-wal"]) rmSync(f, { force: true });
const m = spawnSync(process.execPath, ["scripts/migrate.mjs"], { stdio: "inherit", env: process.env });
if (m.status !== 0) process.exit(m.status ?? 1);
const server = spawn("npx", ["next", "start", "-p", process.env.E2E_PORT ?? "3100"], { stdio: "inherit", env: process.env });
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => server.kill(sig));
server.on("exit", (code) => process.exit(code ?? 0));
