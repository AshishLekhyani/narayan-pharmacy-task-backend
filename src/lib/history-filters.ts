import type { Prisma } from "@prisma/client";

/** Status labels treated as safe / low-risk for filter and stats. */
export const SAFE_ANALYSIS_STATUS_LABELS = [
  "Verified Safe",
  "Low Risk",
  "Single Medication Review",
] as const;

export function buildFlaggedAnalysisWhere(): Prisma.PrescriptionRecordWhereInput {
  return {
    analysisSeverityLevel: { not: null },
    NOT: {
      analysisStatusLabel: { in: [...SAFE_ANALYSIS_STATUS_LABELS] },
    },
  };
}

export function buildSafeAnalysisWhere(): Prisma.PrescriptionRecordWhereInput {
  return {
    analysisSeverityLevel: "low",
    analysisStatusLabel: { in: [...SAFE_ANALYSIS_STATUS_LABELS] },
  };
}
