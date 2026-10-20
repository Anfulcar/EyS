import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests run against a throw-away SQLite file, never a real database.
const dbFile = join(tmpdir(), `eys-vitest-${process.pid}.db`);
const testEnv = { TURSO_DATABASE_URL: `file:${dbFile}`, TURSO_AUTH_TOKEN: "", AUTH_SECRET: "unit-tests-only-not-a-real-secret" };
Object.assign(process.env, testEnv); // visible to the global setup, which runs in this process

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/unit/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    env: testEnv,
    globalSetup: ["tests/unit/global-setup.ts"],
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
});
