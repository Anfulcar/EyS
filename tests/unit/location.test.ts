import { describe, expect, it } from "vitest";
import { databaseRegion } from "@/lib/location";

describe("database location", () => {
  it("reads only the region from the database address", () => {
    expect(databaseRegion("libsql://eys-campanas-org.aws-us-east-1.turso.io")).toBe("aws-us-east-1");
    expect(databaseRegion("libsql://eys-org.aws-sa-east-1.turso.io")).toBe("aws-sa-east-1");
    expect(databaseRegion("file:local.db")).toBe("local");
    expect(databaseRegion("libsql://old-style.turso.io")).toBeNull();
  });
});
