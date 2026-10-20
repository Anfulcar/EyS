import { describe, expect, it } from "vitest";
import { codeLabel, codeMatrixText, parseCode } from "@/lib/catalog";
import { addBusinessDays, toIsoDate } from "@/lib/dates";
import { buildRecords, companyKey } from "@/lib/importer";
import { formatPhone, splitPhones } from "@/lib/sheets";
import { visitPending } from "@/lib/workflow";

describe("dates", () => {
  it("skips weekends when adding business days", () => {
    expect(addBusinessDays("2026-10-30", 1)).toBe("2026-11-02"); // Friday + 1 → Monday
    expect(addBusinessDays("2026-10-28", 5)).toBe("2026-11-04");
  });
  it("reads the date formats used in the Matriz", () => {
    expect(toIsoDate("23/10/2026")).toBe("2026-10-23");
    expect(toIsoDate("2026-10-23")).toBe("2026-10-23");
    expect(toIsoDate(new Date("2026-10-23T00:00:00Z"))).toBe("2026-10-23");
    expect(toIsoDate("")).toBeNull();
  });
});

describe("result codes are shown as text only", () => {
  it("labels have no numbers", () => {
    expect(codeLabel("08", "es")).toBe("No contesta");
    expect(codeLabel("V4", "en")).toBe("Closed (verified on site)");
    expect(codeMatrixText("01")).not.toMatch(/^\d/);
  });
  it("uploads accept old codes and plain text", () => {
    expect(parseCode("08 No contesta")).toBe("08");
    expect(parseCode("8")).toBe("08");
    expect(parseCode("No contesta")).toBe("08");
    expect(parseCode("Wrong number")).toBe("07");
    expect(parseCode("V2 En operación – compromiso con fecha")).toBe("V2");
    expect(parseCode("algo raro")).toBeNull();
  });
});

describe("upload", () => {
  const headers = ["ID SIGTUR", "RUT", "Nombre comercial", "Razón social", "RNC / Cédula", "Teléfono", "Fecha vencimiento", "Columna nueva"];
  it("maps Matriz headers, keeps unknown columns and rejects rows without ID", () => {
    const r = buildRecords(headers, [
      { "ID SIGTUR": 1, RUT: "AB-1", "Nombre comercial": "Bar Uno", "Razón social": "Uno SRL", "RNC / Cédula": "130-000001", Teléfono: "8095550001", "Fecha vencimiento": "01/02/2024", "Columna nueva": "x" },
      { "ID SIGTUR": null, RUT: "AB-2", "Nombre comercial": "Sin ID" },
    ]);
    expect(r.missing).toEqual([]);
    expect(r.records).toHaveLength(1);
    expect(r.records[0]).toMatchObject({ sigturId: "1", rut: "AB-1", fechaVencimiento: "2024-02-01" });
    expect(JSON.parse(String(r.records[0].extra))).toEqual({ "Columna nueva": "x" });
    expect(r.errors).toHaveLength(1);
  });
  it("creates one call task per RUT", () => {
    expect(companyKey({ sigturId: "1", rut: "ab-1", rnc: "130-000001" })).toBe("RUT:AB-1");
    expect(companyKey({ sigturId: "2", rut: null, rnc: "130-000001" })).toBe("ID:2");
  });
  it("splits several phone numbers in one cell", () => {
    expect(splitPhones("(809) 555-0001 / 829-555-0002")).toHaveLength(2);
    expect(formatPhone("8095550001")).toBe("(809) 555-0001");
  });
});

describe("visits", () => {
  it("keeps a visit pending until a conclusive result or two visits", () => {
    expect(visitPending([])).toBe(true);
    expect(visitPending(["V6"])).toBe(true);
    expect(visitPending(["V1"])).toBe(false);
    expect(visitPending(["V5", "V5"])).toBe(false);
  });
});
