import { describe, expect, it } from "vitest";
import { ANALYSIS_PROMPT_VERSION, buildPharmacyPrompt } from "./analyze-prompt";
import { buildMedicationCacheKey } from "./analyze-cache-key";

describe("buildPharmacyPrompt", () => {
  const meds = [
    { name: "Warfarin", dosage: "5mg", frequency: "Once daily (QD)" },
    { name: "Aspirin", dosage: "81mg", frequency: "Once daily (QD)" },
  ];

  it("frames US pharmacy context without assuming a practice setting", () => {
    const prompt = buildPharmacyPrompt(meds);
    expect(prompt).toMatch(/US-based pharmacy/i);
    expect(prompt).not.toMatch(/community pharmacy/i);
    expect(prompt).toMatch(/FDA/i);
    expect(prompt).not.toMatch(/\bIndia\b/i);
    expect(prompt).not.toMatch(/paracetamol/i);
  });

  it("lists submitted medications", () => {
    const prompt = buildPharmacyPrompt(meds);
    expect(prompt).toContain("Warfarin — 5mg, Once daily (QD)");
    expect(prompt).toContain("Aspirin — 81mg, Once daily (QD)");
  });

  it("includes a valid JSON example and exact processedBy string", () => {
    const prompt = buildPharmacyPrompt(meds);
    expect(prompt).toContain('"processedBy":"Claude API — Narayan Pharmacy DDI Engine (US)"');
    const exampleMatch = prompt.match(/\{[\s\S]*"processedBy":"Claude API — Narayan Pharmacy DDI Engine \(US\)"\}/);
    expect(exampleMatch).not.toBeNull();
    expect(() => JSON.parse(exampleMatch![0])).not.toThrow();
  });
});

describe("ANALYSIS_PROMPT_VERSION", () => {
  it("is included in cache keys so prompt upgrades bust stale cache", () => {
    const meds = [{ name: "Metformin", dosage: "500mg", frequency: "Twice daily (BID)" }];
    const key = buildMedicationCacheKey(meds);
    expect(key).toHaveLength(64);
    expect(ANALYSIS_PROMPT_VERSION).toBe("us-3");
  });
});
