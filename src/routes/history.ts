import { Router, Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/database";

const router = Router();

const medicationSchema = z.object({
  name: z.string().trim().min(1, "Drug name is required."),
  dosage: z.string().trim().min(1, "Dosage is required."),
  frequency: z.string().trim().min(1, "Frequency is required."),
});

const aiAnalysisSchema = z.object({
  severity: z.string().trim().optional(),
  severityLevel: z.string().trim().optional(),
  recommendation: z.string().trim().optional(),
  primaryWarning: z.string().trim().optional(),
  clinicalImpact: z.array(z.string().trim()).optional(),
  processedBy: z.string().trim().optional(),
});

const historySchema = z
  .object({
    patientName: z.string().trim().min(2, "Patient name must be at least 2 characters."),
    date: z.string().trim().optional(),
    medications: z.array(medicationSchema).min(1, "At least one medication must be included.").optional(),
    prescriptions: z.array(medicationSchema).min(1, "At least one medication must be included.").optional(),
    aiAnalysis: aiAnalysisSchema.nullish(),
  })
  .superRefine((value, ctx) => {
    if (!value.medications && !value.prescriptions) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["medications"],
        message: "At least one medication must be included.",
      });
    }
  });

type HistoryPayload = z.infer<typeof historySchema>;

function mapRecord(record: {
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
}) {
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

function getMedications(payload: HistoryPayload) {
  return payload.medications ?? payload.prescriptions ?? [];
}

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const records = await prisma.prescriptionRecord.findMany({
      include: {
        items: true,
      },
      orderBy: {
        prescribedAt: "desc",
      },
      take: 100,
    });

    res.status(200).json({
      status: "success",
      data: records.map(mapRecord),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validationResult = historySchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        status: "error",
        message: "Invalid prescription payload.",
        details: validationResult.error.issues,
      });
    }

    const { patientName, date, aiAnalysis } = validationResult.data;
    const medications = getMedications(validationResult.data);

    const newRecord = await prisma.prescriptionRecord.create({
      data: {
        patientName,
        prescribedAt: date ? new Date(date) : undefined,
        analysisStatusLabel: aiAnalysis?.severity,
        analysisSeverityLevel: aiAnalysis?.severityLevel,
        analysisRecommendation: aiAnalysis?.recommendation,
        analysisPrimaryWarning: aiAnalysis?.primaryWarning,
        analysisClinicalImpact: aiAnalysis?.clinicalImpact ?? undefined,
        analysisProcessedBy: aiAnalysis?.processedBy,
        items: {
          create: medications.map((medication) => ({
            medicationName: medication.name,
            dosage: medication.dosage,
            frequency: medication.frequency,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    res.status(201).json({
      status: "success",
      data: mapRecord(newRecord),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
