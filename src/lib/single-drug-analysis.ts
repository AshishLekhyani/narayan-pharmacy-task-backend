import type { AnalysisResultDto } from "./analysis-response";

type MedicationInput = {
  name: string;
  dosage: string;
  frequency: string;
};

/** Rules-engine result when only one medication is present — no Claude API call. */
export function buildSingleDrugAnalysis(medication: MedicationInput): AnalysisResultDto {
  return {
    severity: "Single Medication Review",
    severityLevel: "low",
    primaryWarning: `Only one medication (${medication.name}) is on this prescription — drug-drug interaction screening does not apply.`,
    recommendation:
      "Verify dose, frequency, contraindications, allergies, and patient counselling for this single agent before dispensing. Re-run interaction analysis if additional medications are added.",
    clinicalImpact: [
      "No concurrent agents were submitted for interaction screening.",
      "Standard monotherapy dispensing checks still apply (renal/hepatic adjustment, pregnancy/lactation, duplicate therapy).",
    ],
    processedBy: "Narayan Pharmacy Rules Engine — No AI Call",
  };
}
