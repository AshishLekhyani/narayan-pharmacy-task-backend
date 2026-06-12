import { toPublicAnalysisResponse } from "../lib/analysis-response";
import {
  runInteractionAnalysis,
  type MedicationInput,
} from "./interaction-analysis";
import { createPrescriptionRecord } from "./prescription-service";

export async function analyzeAndSavePrescription(input: {
  patientName: string;
  date: string;
  medications: MedicationInput[];
}) {
  const { analysis, cachedResult, localResult } = await runInteractionAnalysis(input.medications);

  const record = await createPrescriptionRecord({
    patientName: input.patientName,
    date: input.date,
    medications: input.medications,
    aiAnalysis: {
      severity: analysis.severity,
      severityLevel: analysis.severityLevel,
      recommendation: analysis.recommendation,
      primaryWarning: analysis.primaryWarning,
      clinicalImpact: analysis.clinicalImpact,
      processedBy: analysis.processedBy,
    },
  });

  const publicAnalysis = {
    ...toPublicAnalysisResponse(analysis, cachedResult),
    localResult,
  };

  return { analysis: publicAnalysis, record };
}
