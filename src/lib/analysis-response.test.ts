import { describe, expect, it } from "vitest";
import {
  ANALYSIS_JSON_REPAIR_PROMPT,
  extractJsonFromModelText,
  normalizeAnalysisPayload,
  normalizeSeverityLabel,
  parseAnalysisResult,
  parseModelAnalysisText,
  PROCESSED_BY_DEFAULT,
  reconcileSeverityFields,
  toPublicAnalysisResponse,
} from "./analysis-response";

const validPayload = {
  severityLevel: "low" as const,
  severity: "Verified Safe" as const,
  primaryWarning: "No interaction identified.",
  recommendation: "Dispense as written with routine counseling.",
  clinicalImpact: ["No CYP interaction expected.", "Routine monitoring sufficient."],
  processedBy: PROCESSED_BY_DEFAULT,
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

describe("normalizeSeverityLabel", () => {
  it("maps common aliases", () => {
    expect(normalizeSeverityLabel("moderate")).toBe("Potential Interaction");
    expect(normalizeSeverityLabel("Contraindicated")).toBe("Critical Conflict");
    expect(normalizeSeverityLabel("safe")).toBe("Verified Safe");
  });
});

describe("reconcileSeverityFields", () => {
  it("forces high for Critical Conflict", () => {
    expect(reconcileSeverityFields("Critical Conflict", "low")).toEqual({
      severity: "Critical Conflict",
      severityLevel: "high",
    });
  });

  it("forces low for Verified Safe even when model returns high", () => {
    expect(reconcileSeverityFields("Verified Safe", "high")).toEqual({
      severity: "Verified Safe",
      severityLevel: "low",
    });
  });
});

describe("normalizeAnalysisPayload", () => {
  it("normalizes severityLevel casing and pads clinicalImpact", () => {
    const normalized = normalizeAnalysisPayload({
      severityLevel: "LOW",
      severity: "verified safe",
      primaryWarning: "No issues found.",
      recommendation: "Dispense as written.",
      clinicalImpact: ["Routine monitoring."],
      processedBy: "",
    });

    expect(normalized).toMatchObject({
      severityLevel: "low",
      severity: "Verified Safe",
      clinicalImpact: expect.arrayContaining([
        "Routine monitoring.",
        expect.stringContaining("dispensing precautions"),
      ]),
      processedBy: PROCESSED_BY_DEFAULT,
    });
    expect(normalized?.clinicalImpact).toHaveLength(2);
  });
});

describe("parseAnalysisResult", () => {
  it("accepts a valid clinical payload", () => {
    expect(parseAnalysisResult(validPayload)).toEqual(validPayload);
  });

  it("coerces High severityLevel and Moderate severity label", () => {
    const result = parseAnalysisResult({
      severityLevel: "High",
      severity: "Moderate Interaction",
      primaryWarning: "Warfarin and aspirin may increase bleeding risk.",
      recommendation: "Counsel on bleeding signs and contact prescriber if needed.",
      clinicalImpact: ["Additive antiplatelet effect."],
      processedBy: "Claude",
    });

    expect(result.severityLevel).toBe("low");
    expect(result.severity).toBe("Potential Interaction");
    expect(result.processedBy).toBe(PROCESSED_BY_DEFAULT);
    expect(result.clinicalImpact).toHaveLength(2);
  });

  it("rejects incomplete payloads", () => {
    expect(() => parseAnalysisResult({ severity: "Verified Safe" })).toThrow(
      /required clinical analysis format/i
    );
  });
});

describe("parseModelAnalysisText", () => {
  it("parses fenced JSON end-to-end", () => {
    const result = parseModelAnalysisText("```json\n" + JSON.stringify(validPayload) + "\n```");
    expect(result.severity).toBe("Verified Safe");
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

describe("ANALYSIS_JSON_REPAIR_PROMPT", () => {
  it("mentions required processedBy string", () => {
    expect(ANALYSIS_JSON_REPAIR_PROMPT).toContain(PROCESSED_BY_DEFAULT);
  });
});
