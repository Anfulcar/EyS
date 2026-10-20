import { describe, expect, it } from "vitest";
import { MANUAL, WHATS_NEW } from "@/lib/manual";

describe("manual", () => {
  it("has the same sections in Spanish and English", () => {
    expect(MANUAL.es.map((s) => s.id)).toEqual(MANUAL.en.map((s) => s.id));
  });
  it("covers every role", () => {
    for (const role of ["admin", "supervisor", "agent", "inspector"]) {
      expect(MANUAL.es.some((s) => s.roles.includes(role))).toBe(true);
    }
  });
  it("has dated What's new lines, newest first, in both languages", () => {
    expect(WHATS_NEW.length).toBeGreaterThan(0);
    for (const w of WHATS_NEW) {
      expect(w.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(w.es && w.en).toBeTruthy();
    }
    expect([...WHATS_NEW].map((w) => w.date)).toEqual([...WHATS_NEW].map((w) => w.date).sort().reverse());
  });
});
