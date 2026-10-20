import { defineConfig } from "@playwright/test";
import { randomBytes } from "node:crypto";

// Test-only credentials are generated for each run; nothing secret is stored in the repository.
process.env.E2E_ADMIN_PASSWORD ??= randomBytes(12).toString("base64url");
process.env.E2E_AUTH_SECRET ??= randomBytes(32).toString("base64");
const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 180_000,
  expect: { timeout: 20_000 },
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: {
    command: "node scripts/e2e-server.mjs",
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      E2E_PORT: String(PORT),
      TURSO_DATABASE_URL: "file:e2e.db",
      TURSO_AUTH_TOKEN: "",
      AUTH_SECRET: process.env.E2E_AUTH_SECRET!,
      ADMIN_USERNAME: "admin",
      ADMIN_PASSWORD: process.env.E2E_ADMIN_PASSWORD!,
      ADMIN_NAME: "Admin Prueba",
    },
  },
});
