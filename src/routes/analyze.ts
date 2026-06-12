import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { toPublicAnalysisResponse } from "../lib/analysis-response";
import { clinicalMedicationSchema } from "../lib/clinical-input";
import { MAX_MEDICATIONS_PER_PRESCRIPTION } from "../lib/constants";
import { firstZodIssueMessage, sendError } from "../lib/http";
import { aiAnalysisLimiter } from "../lib/rate-limiters";
import { pickMedicationList } from "../lib/payload";
import {
  AnalysisServiceError,
  mapAnthropicError,
  runInteractionAnalysis,
} from "../services/interaction-analysis";

const router = Router();

const analyzeSchema = z
  .object({
    drugs: z.array(clinicalMedicationSchema).max(MAX_MEDICATIONS_PER_PRESCRIPTION).optional(),
    medications: z.array(clinicalMedicationSchema).max(MAX_MEDICATIONS_PER_PRESCRIPTION).optional(),
  })
  .superRefine((val, ctx) => {
    const list = pickMedicationList(val);
    if (list.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["medications"],
        message: "Add at least one medication before running analysis.",
      });
    }
  });

router.post("/", aiAnalysisLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validationResult = analyzeSchema.safeParse(req.body);
    if (!validationResult.success) {
      return sendError(
        res,
        400,
        firstZodIssueMessage(validationResult.error, "Malformed payload structure.")
      );
    }

    const medications = pickMedicationList(validationResult.data);
    const { analysis, cachedResult, localResult } = await runInteractionAnalysis(medications);

    return res.status(200).json({
      ...toPublicAnalysisResponse(analysis, cachedResult),
      localResult,
    });
  } catch (error) {
    if (error instanceof AnalysisServiceError) {
      return sendError(res, error.status, error.message);
    }
    const mapped = mapAnthropicError(error);
    if (mapped) {
      return sendError(res, mapped.status, mapped.message);
    }
    next(error);
  }
});

export default router;
