import type { Prisma } from "@prisma/client";

export type PrescriptionRecordWithItems = {
  id: number;
  patientName: string;
  prescribedAt: Date;
  analysisStatusLabel: string | null;
  analysisSeverityLevel: string | null;
  analysisRecommendation: string | null;
  analysisPrimaryWarning: string | null;
  analysisClinicalImpact: Prisma.JsonValue | null;
  analysisProcessedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{
    id: number;
    medicationName: string;
    dosage: string;
    frequency: string;
  }>;
};

export function mapPrescriptionRecord(record: PrescriptionRecordWithItems) {
  const clinicalImpact = Array.isArray(record.analysisClinicalImpact)
    ? record.analysisClinicalImpact.filter((value): value is string => typeof value === "string")
    : [];

  return {
    id: record.id,
    patientName: record.patientName,
    prescribedAt: record.prescribedAt,
    medications: record.items.map((item) => ({
      id: item.id,
      name: item.medicationName,
      dosage: item.dosage,
      frequency: item.frequency,
    })),
    analysis: {
      statusLabel: record.analysisStatusLabel,
      severityLevel: record.analysisSeverityLevel,
      recommendation: record.analysisRecommendation,
      primaryWarning: record.analysisPrimaryWarning,
      clinicalImpact,
      processedBy: record.analysisProcessedBy,
    },
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
