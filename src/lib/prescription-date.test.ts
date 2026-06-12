import { describe, expect, it } from "vitest";
import { parsePrescriptionDateToUtc } from "./prescription-date";

describe("parsePrescriptionDateToUtc", () => {
  it("stores calendar date at UTC midnight", () => {
    const date = parsePrescriptionDateToUtc("2026-06-12");
    expect(date.toISOString()).toBe("2026-06-12T00:00:00.000Z");
  });

  it("ignores time portion on ISO datetime strings", () => {
    const date = parsePrescriptionDateToUtc("2026-06-12T15:30:00.000Z");
    expect(date.toISOString()).toBe("2026-06-12T00:00:00.000Z");
  });
});
