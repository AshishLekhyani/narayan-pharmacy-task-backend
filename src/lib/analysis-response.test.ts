import { describe, expect, it } from "vitest";
import {
  extractJsonFromModelText,
  parseAnalysisResult,
  toPublicAnalysisResponse,
} from "./analysis-response";

const validPayload = {
  severityLevel: "low" as const,
  severity: "Verified Safe",
  primaryWarning: "No interaction identified.",
  recommendation: "Dispense as written with routine counselling.",
  clinicalImpact: ["No CYP interaction expected.", "Routine monitoring sufficient."],
  processedBy: "Claude API — Narayan Pharmacy DDI Engine",
};

describe("extractJsonFromModelText", () => {
  it("parses raw JSON", () => {
    const raw = extractJsonFromModelText(JSON.stringify(validPayload));
    expect(raw).toEqual(validPayload);
  });

  it("strips markdown fences", () => {
    const raw = extractJsonFromModelText(
      "```json\n" + JSON.stringify(validPayload) + "\n```"
    );
    expect(raw).toEqual(validPayload);
  });
});

describe("parseAnalysisResult", () => {
  it("accepts a valid clinical payload", () => {
    expect(parseAnalysisResult(validPayload)).toEqual(validPayload);
  });

  it("rejects incomplete payloads", () => {
    expect(() => parseAnalysisResult({ severity: "Verified Safe" })).toThrow(
      /required clinical analysis format/i
    );
  });
});

describe("toPublicAnalysisResponse", () => {
  it("whitelists fields and adds cache flag", () => {
    const publicResult = toPublicAnalysisResponse(validPayload, true);
    expect(publicResult.cachedResult).toBe(true);
    expect(publicResult.severity).toBe("Verified Safe");
    expect(Object.keys(publicResult).sort()).toEqual(
      [
        "cachedResult",
        "clinicalImpact",
        "primaryWarning",
        "processedBy",
        "recommendation",
        "severity",
        "severityLevel",
      ].sort()
    );
  });
});
