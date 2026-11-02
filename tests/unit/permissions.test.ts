import { describe, expect, it } from "vitest";
import type { User } from "@/db/schema";
import { hasCalls, homeFor, mayUse } from "@/lib/auth";

const u = (role: string, callsAccess: boolean) => ({ role, callsAccess }) as User;

describe("permissions per module", () => {
  it("call screens need the role and «Campañas de llamadas»; administrators always have it", () => {
    expect(mayUse(u("agent", true), ["agent"])).toBe(true);
    expect(mayUse(u("agent", false), ["agent"])).toBe(false);
    expect(mayUse(u("supervisor", false), ["admin", "supervisor"])).toBe(false);
    expect(mayUse(u("admin", false), ["admin"])).toBe(true);
    expect(mayUse(u("inspector", true), ["admin"])).toBe(false);
    expect(hasCalls(u("admin", false))).toBe(true);
  });
  it("people without call campaigns start on the help page", () => {
    expect(homeFor(u("agent", false))).toBe("/help");
    expect(homeFor(u("agent", true))).toBe("/calls");
    expect(homeFor(u("admin", false))).toBe("/campaigns");
  });
});
