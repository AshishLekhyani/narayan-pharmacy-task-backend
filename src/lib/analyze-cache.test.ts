import { describe, expect, it } from "vitest";
import { buildMedicationCacheKey } from "./analyze-cache-key";

describe("buildMedicationCacheKey", () => {
  it("is order-independent for the same drug set", () => {
    const a = buildMedicationCacheKey([
      { name: "Aspirin", dosage: "75mg", frequency: "OD (Once Daily)" },
      { name: "Metformin", dosage: "500mg", frequency: "BD (Twice Daily)" },
    ]);
    const b = buildMedicationCacheKey([
      { name: "metformin", dosage: "500MG", frequency: "bd (twice daily)" },
      { name: "ASPIRIN", dosage: "75mg", frequency: "od (once daily)" },
    ]);
    expect(a).toBe(b);
  });

  it("changes when any medication field changes", () => {
    const base = buildMedicationCacheKey([
      { name: "Aspirin", dosage: "75mg", frequency: "OD (Once Daily)" },
      { name: "Metformin", dosage: "500mg", frequency: "BD (Twice Daily)" },
    ]);
    const differentDosage = buildMedicationCacheKey([
      { name: "Aspirin", dosage: "100mg", frequency: "OD (Once Daily)" },
      { name: "Metformin", dosage: "500mg", frequency: "BD (Twice Daily)" },
    ]);
    expect(base).not.toBe(differentDosage);
  });
});
