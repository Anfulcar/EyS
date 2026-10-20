import { isRecentAuth } from "@/lib/session";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as { headers: { source: string; headers: { key: string; value: string }[] }[] };
const all = Object.fromEntries(vercel.headers.find((h) => h.source === "/(.*)")!.headers.map((h) => [h.key, h.value]));

describe("security headers in vercel.json", () => {
  it("has every required header", () => {
    expect(all["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(all["Content-Security-Policy"]).toContain("default-src 'self'");
    expect(all["X-Frame-Options"]).toBe("DENY");
    expect(all["X-Content-Type-Options"]).toBe("nosniff");
    expect(all["Referrer-Policy"]).toBeTruthy();
    expect(all["Permissions-Policy"]).toContain("camera=()");
    expect(all["Strict-Transport-Security"]).toContain("max-age=");
  });
});

describe("no secrets in the repository examples", () => {
  it(".env.example lists names only", () => {
    for (const line of readFileSync(".env.example", "utf8").split("\n")) {
      if (!line.trim() || line.startsWith("#")) continue;
      expect(line).toMatch(/^[A-Z0-9_]+=$/);
    }
  });
});


describe("password asked again for sensitive actions", () => {
  const now = Date.parse("2026-10-20T15:00:00Z");
  it("is not needed within 10 minutes of typing the password", () => {
    expect(isRecentAuth(now - 9 * 60_000, now, 10)).toBe(true);
  });
  it("is needed after 10 minutes, or when the time is unknown", () => {
    expect(isRecentAuth(now - 11 * 60_000, now, 10)).toBe(false);
    expect(isRecentAuth(undefined, now, 10)).toBe(false);
  });
});
