import type { StoredAiAnalysisDto } from "../lib/analysis-response";
import { prisma } from "../lib/database";
import { mapPrescriptionRecord } from "../lib/history-mapper";
import type { MedicationInput } from "../lib/medication-input";
import { parsePrescriptionDateToUtc } from "../lib/prescription-date";

export type { MedicationInput };

export async function createPrescriptionRecord(input: {
  patientName: string;
  date?: string;
  medications: MedicationInput[];
  aiAnalysis: StoredAiAnalysisDto | null;
}) {
  let prescribedAt: Date | undefined;
  if (input.date) {
    try {
      prescribedAt = parsePrescriptionDateToUtc(input.date);
    } catch {
      throw new PrescriptionServiceError(400, "Invalid prescription date.");
    }
  }

  const aiAnalysis = input.aiAnalysis;

  const newRecord = await prisma.$transaction(async (tx) => {
    return tx.prescriptionRecord.create({
      data: {
        patientName: input.patientName,
        prescribedAt,
        analysisStatusLabel: aiAnalysis?.severity,
        analysisSeverityLevel: aiAnalysis?.severityLevel,
        analysisRecommendation: aiAnalysis?.recommendation,
        analysisPrimaryWarning: aiAnalysis?.primaryWarning,
        analysisClinicalImpact: aiAnalysis?.clinicalImpact ?? undefined,
        analysisProcessedBy: aiAnalysis?.processedBy,
        items: {
          create: input.medications.map((medication) => ({
            medicationName: medication.name,
            dosage: medication.dosage,
            frequency: medication.frequency,
          })),
        },
      },
      include: { items: true },
    });
  });

  return mapPrescriptionRecord(newRecord);
}

export class PrescriptionServiceError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "PrescriptionServiceError";
  }
}
