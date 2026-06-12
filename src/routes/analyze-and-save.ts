import { Router, Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import {
  clinicalMedicationSchema,
  clinicalPatientNameSchema,
} from "../lib/clinical-input";
import { MAX_MEDICATIONS_PER_PRESCRIPTION } from "../lib/constants";
import { firstZodIssueMessage, sendError, sendSuccess } from "../lib/http";
import { mapPrismaError } from "../lib/prisma-errors";
import { analyzeAndSavePrescription } from "../services/analyze-and-save";
import {
  AnalysisServiceError,
  mapAnthropicError,
} from "../services/interaction-analysis";
import { PrescriptionServiceError } from "../services/prescription-service";

const router = Router();

const analyzeAndSaveSchema = z.object({
  patientName: clinicalPatientNameSchema,
  date: z.string().trim().min(1, "Prescription date is required.").max(32),
  medications: z
    .array(clinicalMedicationSchema)
    .min(1, "Add at least one medication before running analysis.")
    .max(MAX_MEDICATIONS_PER_PRESCRIPTION),
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { status: "error", message: "AI Analysis rate limit exceeded. Please wait before retrying." },
});

router.post("/", aiLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validationResult = analyzeAndSaveSchema.safeParse(req.body);
    if (!validationResult.success) {
      return sendError(
        res,
        400,
        firstZodIssueMessage(validationResult.error, "Invalid prescription payload.")
      );
    }

    const { patientName, date, medications } = validationResult.data;
    const result = await analyzeAndSavePrescription({ patientName, date, medications });

    return sendSuccess(res, result, 201);
  } catch (error) {
    if (error instanceof AnalysisServiceError || error instanceof PrescriptionServiceError) {
      return sendError(res, error.status, error.message);
    }
    const mappedAi = mapAnthropicError(error);
    if (mappedAi) {
      return sendError(res, mappedAi.status, mappedAi.message);
    }
    const mappedDb = mapPrismaError(error);
    if (mappedDb) {
      return sendError(res, mappedDb.status, mappedDb.message);
    }
    next(error);
  }
});

export default router;
