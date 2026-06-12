import { z } from "zod";

export const PROCESSED_BY_DEFAULT = "Claude API — Narayan Pharmacy DDI Engine (US)";

/** Canonical severity labels for AI and rules-engine responses. */
export const ANALYSIS_SEVERITY_LABELS = [
  "Critical Conflict",
  "Potential Interaction",
  "Low Risk",
  "Verified Safe",
  "Drug Identification Required",
  "Single Medication Review",
] as const;

export type AnalysisSeverityLabel = (typeof ANALYSIS_SEVERITY_LABELS)[number];

const HIGH_SEVERITY_LABELS = new Set<AnalysisSeverityLabel>(["Critical Conflict"]);
const LOW_SEVERITY_LABELS = new Set<AnalysisSeverityLabel>([
  "Potential Interaction",
  "Low Risk",
  "Verified Safe",
  "Drug Identification Required",
  "Single Medication Review",
]);

const SEVERITY_ALIAS_MAP: Record<string, AnalysisSeverityLabel> = {
  "critical conflict": "Critical Conflict",
  critical: "Critical Conflict",
  contraindicated: "Critical Conflict",
  major: "Critical Conflict",
  severe: "Critical Conflict",
  "potential interaction": "Potential Interaction",
  moderate: "Potential Interaction",
  "moderate interaction": "Potential Interaction",
  interaction: "Potential Interaction",
  "low risk": "Low Risk",
  minor: "Low Risk",
  "verified safe": "Verified Safe",
  safe: "Verified Safe",
  "no interaction": "Verified Safe",
  "drug identification required": "Drug Identification Required",
  "identification required": "Drug Identification Required",
  unrecognized: "Drug Identification Required",
  "single medication review": "Single Medication Review",
};

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeSeverityLevel(value: unknown): "high" | "low" | null {
  const raw = asTrimmedString(value);
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower === "high" || lower === "severe" || lower === "critical") return "high";
  if (lower === "low" || lower === "mild" || lower === "moderate" || lower === "minor") return "low";
  return null;
}

export function normalizeSeverityLabel(value: unknown): AnalysisSeverityLabel | null {
  const raw = asTrimmedString(value);
  if (!raw) return null;

  if ((ANALYSIS_SEVERITY_LABELS as readonly string[]).includes(raw)) {
    return raw as AnalysisSeverityLabel;
  }

  const alias = SEVERITY_ALIAS_MAP[raw.toLowerCase()];
  if (alias) return alias;

  if (raw.toLowerCase().includes("critical") || raw.toLowerCase().includes("contraindicated")) {
    return "Critical Conflict";
  }
  if (raw.toLowerCase().includes("identification")) {
    return "Drug Identification Required";
  }
  if (raw.toLowerCase().includes("verified") || raw.toLowerCase().includes("no interaction")) {
    return "Verified Safe";
  }
  if (raw.toLowerCase().includes("potential") || raw.toLowerCase().includes("moderate")) {
    return "Potential Interaction";
  }

  return null;
}

export function reconcileSeverityFields(
  severity: AnalysisSeverityLabel,
  severityLevel: "high" | "low"
): { severity: AnalysisSeverityLabel; severityLevel: "high" | "low" } {
  if (HIGH_SEVERITY_LABELS.has(severity)) {
    return { severity, severityLevel: "high" };
  }

  if (LOW_SEVERITY_LABELS.has(severity)) {
    return { severity, severityLevel: "low" };
  }

  return { severity, severityLevel };
}

function normalizeClinicalImpact(value: unknown, primaryWarning: string): string[] {
  const items = Array.isArray(value)
    ? value
        .map((entry) => asTrimmedString(entry))
        .filter((entry): entry is string => Boolean(entry))
    : [];

  if (items.length >= 2) {
    return items.slice(0, 4);
  }

  if (items.length === 1) {
    return [items[0], "Apply standard US dispensing precautions and patient counseling for this regimen."];
  }

  return [
    primaryWarning,
    "Apply standard US dispensing precautions and patient counseling for this regimen.",
  ];
}

function normalizeProcessedBy(value: unknown): string {
  const raw = asTrimmedString(value);
  if (!raw) return PROCESSED_BY_DEFAULT;
  if (raw === PROCESSED_BY_DEFAULT) return PROCESSED_BY_DEFAULT;
  if (raw.toLowerCase().includes("narayan pharmacy")) return PROCESSED_BY_DEFAULT;
  if (/claude/i.test(raw) && !raw.includes("DDI Engine")) return PROCESSED_BY_DEFAULT;
  return raw;
}

/** Coerce common Claude formatting mistakes before strict Zod validation. */
export function normalizeAnalysisPayload(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const record = raw as Record<string, unknown>;
  const severity = normalizeSeverityLabel(record.severity);
  const severityLevel = normalizeSeverityLevel(record.severityLevel);
  const primaryWarning = asTrimmedString(record.primaryWarning);
  const recommendation = asTrimmedString(record.recommendation);

  if (!severity || !severityLevel || !primaryWarning || !recommendation) {
    return null;
  }

  const reconciled = reconcileSeverityFields(severity, severityLevel);

  return {
    severity: reconciled.severity,
    severityLevel: reconciled.severityLevel,
    primaryWarning,
    recommendation,
    clinicalImpact: normalizeClinicalImpact(record.clinicalImpact, primaryWarning),
    processedBy: normalizeProcessedBy(record.processedBy),
  };
}

/** Canonical shape returned to the frontend after Claude or cache lookup. */
export const analysisResultSchema = z.object({
  severityLevel: z.enum(["high", "low"]),
  severity: z.enum(ANALYSIS_SEVERITY_LABELS),
  primaryWarning: z.string().trim().min(1),
  recommendation: z.string().trim().min(1),
  clinicalImpact: z.array(z.string().trim().min(1)).min(2).max(4),
  processedBy: z.string().trim().min(1),
});

export type AnalysisResultDto = z.infer<typeof analysisResultSchema>;

/** Fields persisted on PrescriptionRecord when saving after analysis. */
export const storedAiAnalysisSchema = z.object({
  severity: analysisResultSchema.shape.severity,
  severityLevel: analysisResultSchema.shape.severityLevel,
  primaryWarning: analysisResultSchema.shape.primaryWarning,
  recommendation: analysisResultSchema.shape.recommendation,
  clinicalImpact: analysisResultSchema.shape.clinicalImpact,
  processedBy: analysisResultSchema.shape.processedBy,
});

export type StoredAiAnalysisDto = z.infer<typeof storedAiAnalysisSchema>;

export const ANALYSIS_JSON_REPAIR_PROMPT = `Your previous reply was not valid JSON or did not match the required schema.
Return ONLY one corrected JSON object with these exact fields:
- severityLevel: "high" or "low" (lowercase only)
- severity: exactly one of Critical Conflict, Potential Interaction, Low Risk, Verified Safe, Drug Identification Required
- primaryWarning: non-empty string
- recommendation: non-empty string
- clinicalImpact: array of 2 to 4 non-empty strings
- processedBy: exactly "${PROCESSED_BY_DEFAULT}"

Rules:
- Critical Conflict must use severityLevel "high".
- All other severity labels must use severityLevel "low".
- Never pair severityLevel "high" with Verified Safe or Low Risk.
- No markdown. No commentary. JSON only.`;

/** Strip markdown code fences and extract the JSON object Claude sometimes wraps. */
export function extractJsonFromModelText(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in model output.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new Error("Model output contained invalid JSON.");
  }

  return parsed;
}

export function parseAnalysisResult(raw: unknown): AnalysisResultDto {
  const normalized = normalizeAnalysisPayload(raw);
  const parsed = analysisResultSchema.safeParse(normalized);
  if (!parsed.success) {
    throw new Error("AI response did not match the required clinical analysis format.");
  }
  return parsed.data;
}

export function parseModelAnalysisText(text: string): AnalysisResultDto {
  return parseAnalysisResult(extractJsonFromModelText(text));
}

/** Whitelist-only payload sent to the frontend — never leak raw Claude/cache JSON. */
export function toPublicAnalysisResponse(
  result: AnalysisResultDto,
  cachedResult: boolean
): AnalysisResultDto & { cachedResult: boolean } {
  return {
    severityLevel: result.severityLevel,
    severity: result.severity,
    primaryWarning: result.primaryWarning,
    recommendation: result.recommendation,
    clinicalImpact: result.clinicalImpact,
    processedBy: result.processedBy,
    cachedResult,
  };
}
