import { z } from "zod";

/** Canonical shape returned to the frontend after Claude or cache lookup. */
export const analysisResultSchema = z.object({
  severityLevel: z.enum(["high", "low"]),
  severity: z.string().trim().min(1),
  primaryWarning: z.string().trim().min(1),
  recommendation: z.string().trim().min(1),
  clinicalImpact: z.array(z.string().trim()).min(1),
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

  return JSON.parse(candidate.slice(start, end + 1));
}

export function parseAnalysisResult(raw: unknown): AnalysisResultDto {
  const parsed = analysisResultSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("AI response did not match the required clinical analysis format.");
  }
  return parsed.data;
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
