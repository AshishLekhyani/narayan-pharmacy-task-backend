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
      "Verify dose, frequency, contraindications, allergies, and patient counseling for this single agent before dispensing. Re-run interaction analysis if additional medications are added.",
    clinicalImpact: [
      "No concurrent agents were submitted for drug-drug interaction screening.",
      "Standard US monotherapy checks still apply: renal/hepatic dosing, pregnancy/lactation counseling, and duplicate-ingredient review across OTC/Rx products.",
    ],
    processedBy: "Narayan Pharmacy Rules Engine (US) — No AI Call",
  };
}
