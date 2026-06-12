import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { MAX_BATCH_DELETE_IDS } from "../lib/constants";
import { prisma } from "../lib/database";
import {
  buildHistoryWhere,
  historyListQuerySchema,
} from "../lib/history-query";
import { mapPrescriptionRecord } from "../lib/history-mapper";
import { getGlobalHistoryStats } from "../lib/history-stats";
import { firstZodIssueMessage, sendError, sendSuccess } from "../lib/http";
import { mapPrismaError } from "../lib/prisma-errors";
const router = Router();

const batchDeleteSchema = z.object({
  ids: z
    .array(z.coerce.number().int().positive())
    .min(1, "Select at least one record to delete.")
    .max(MAX_BATCH_DELETE_IDS),
});

router.get("/stats", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await getGlobalHistoryStats();
    return sendSuccess(res, stats);
  } catch (error) {
    const mapped = mapPrismaError(error);
    if (mapped) return sendError(res, mapped.status, mapped.message);
    next(error);
  }
});

router.delete("/batch", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validationResult = batchDeleteSchema.safeParse(req.body);
    if (!validationResult.success) {
      return sendError(
        res,
        400,
        firstZodIssueMessage(validationResult.error, "Invalid delete payload.")
      );
    }

    const { ids } = validationResult.data;
    const uniqueIds = [...new Set(ids)];

    const result = await prisma.prescriptionRecord.deleteMany({
      where: { id: { in: uniqueIds } },
    });

    return sendSuccess(res, { deletedCount: result.count, requestedIds: uniqueIds });
  } catch (error) {
    const mapped = mapPrismaError(error);
    if (mapped) return sendError(res, mapped.status, mapped.message);
    next(error);
  }
});

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedQuery = historyListQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return sendError(
        res,
        400,
        firstZodIssueMessage(parsedQuery.error, "Invalid query parameters.")
      );
    }

    const { page, limit, search, filter } = parsedQuery.data;
    const where = buildHistoryWhere(search, filter);
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      prisma.prescriptionRecord.findMany({
        where,
        include: { items: true },
        orderBy: { prescribedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.prescriptionRecord.count({ where }),
    ]);

    return res.status(200).json({
      status: "success",
      data: records.map(mapPrescriptionRecord),
      meta: {
        page,
        pageSize: limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        filter,
        search: search ?? "",
      },
    });
  } catch (error) {
    const mapped = mapPrismaError(error);
    if (mapped) return sendError(res, mapped.status, mapped.message);
    next(error);
  }
});

router.post("/", (req: Request, res: Response) => {
  if (
    req.body &&
    typeof req.body === "object" &&
    "aiAnalysis" in req.body &&
    (req.body as { aiAnalysis?: unknown }).aiAnalysis != null
  ) {
    return sendError(
      res,
      400,
      "Direct saves with client-supplied analysis are not allowed. Use POST /api/prescriptions/analyze-and-save."
    );
  }

  return sendError(
    res,
    410,
    "Manual prescription saves are deprecated. Use POST /api/prescriptions/analyze-and-save to analyze and persist in one step."
  );
});

export default router;
