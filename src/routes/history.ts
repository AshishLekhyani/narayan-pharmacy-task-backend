import { Router, Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/database";
import {
  buildHistoryWhere,
  historyListQuerySchema,
} from "../lib/history-query";

const router = Router();

const MAX_MEDICATIONS = 50;
const MAX_PATIENT_NAME = 200;

const medicationSchema = z.object({
  name: z.string().trim().min(1, "Drug name is required.").max(200),
  dosage: z.string().trim().min(1, "Dosage is required.").max(100),
  frequency: z.string().trim().min(1, "Frequency is required.").max(100),
});

const aiAnalysisSchema = z.object({
  severity: z.string().trim().max(200).optional(),
  severityLevel: z.enum(["high", "low"]).optional(),
  recommendation: z.string().trim().max(5000).optional(),
  primaryWarning: z.string().trim().max(2000).optional(),
  clinicalImpact: z.array(z.string().trim().max(1000)).max(20).optional(),
  processedBy: z.string().trim().max(200).optional(),
});

const historySchema = z
  .object({
    patientName: z
      .string()
      .trim()
      .min(2, "Patient name must be at least 2 characters.")
      .max(MAX_PATIENT_NAME),
    date: z.string().trim().max(32).optional(),
    medications: z
      .array(medicationSchema)
      .min(1, "At least one medication must be included.")
      .max(MAX_MEDICATIONS)
      .optional(),
    prescriptions: z
      .array(medicationSchema)
      .min(1, "At least one medication must be included.")
      .max(MAX_MEDICATIONS)
      .optional(),
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

async function getGlobalStats() {
  const [totalRecords, severeAlerts, aiFlagged, safeCount] = await Promise.all([
    prisma.prescriptionRecord.count(),
    prisma.prescriptionRecord.count({ where: { analysisSeverityLevel: "high" } }),
    prisma.prescriptionRecord.count({ where: { analysisStatusLabel: { not: null } } }),
    prisma.prescriptionRecord.count({ where: { NOT: { analysisSeverityLevel: "high" } } }),
  ]);

  const validationRate =
    totalRecords === 0 ? 0 : Math.round((safeCount / totalRecords) * 1000) / 10;

  return { totalRecords, severeAlerts, aiFlagged, validationRate };
}

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedQuery = historyListQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({
        status: "error",
        message: parsedQuery.error.issues[0]?.message ?? "Invalid query parameters.",
      });
    }

    const { page, limit, search, filter } = parsedQuery.data;
    const where = buildHistoryWhere(search, filter);
    const skip = (page - 1) * limit;

    const [records, total, stats] = await Promise.all([
      prisma.prescriptionRecord.findMany({
        where,
        include: { items: true },
        orderBy: { prescribedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.prescriptionRecord.count({ where }),
      getGlobalStats(),
    ]);

    res.status(200).json({
      status: "success",
      data: records.map(mapRecord),
      meta: {
        page,
        pageSize: limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        filter,
        search: search ?? "",
      },
      stats,
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
        message: validationResult.error.issues[0]?.message ?? "Invalid prescription payload.",
      });
    }

    const { patientName, date, aiAnalysis } = validationResult.data;
    const medications = getMedications(validationResult.data);

    let prescribedAt: Date | undefined;
    if (date) {
      const parsedDate = new Date(date);
      if (Number.isNaN(parsedDate.getTime())) {
        return res.status(400).json({
          status: "error",
          message: "Invalid prescription date.",
        });
      }
      prescribedAt = parsedDate;
    }

    const newRecord = await prisma.$transaction(async (tx) => {
      return tx.prescriptionRecord.create({
        data: {
          patientName,
          prescribedAt,
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
        include: { items: true },
      });
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
