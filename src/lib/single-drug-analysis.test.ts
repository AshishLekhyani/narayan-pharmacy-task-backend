import { describe, expect, it } from "vitest";
import { buildSingleDrugAnalysis } from "./single-drug-analysis";

describe("buildSingleDrugAnalysis", () => {
  it("returns rules-engine result without AI fields for a single medication", () => {
    const result = buildSingleDrugAnalysis({
      name: "Lisinopril",
      dosage: "10mg",
      frequency: "OD (Once Daily)",
    });

    expect(result.severity).toBe("Single Medication Review");
    expect(result.severityLevel).toBe("low");
    expect(result.primaryWarning).toContain("Lisinopril");
    expect(result.processedBy).toContain("Rules Engine");
    expect(result.clinicalImpact.length).toBeGreaterThan(0);
  });
});
