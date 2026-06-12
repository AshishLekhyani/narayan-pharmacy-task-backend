import { Prisma } from "@prisma/client";
import { z } from "zod";
import { buildFlaggedAnalysisWhere, buildSafeAnalysisWhere } from "./history-filters";

export const HISTORY_PAGE_SIZE = 10;
export const HISTORY_MAX_PAGE_SIZE = 50;
export const HISTORY_EXPORT_LIMIT = 500;
export const HISTORY_SEARCH_MAX = 100;

export const historyListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(HISTORY_MAX_PAGE_SIZE).default(HISTORY_PAGE_SIZE),
  search: z.string().trim().max(HISTORY_SEARCH_MAX).optional(),
  filter: z.enum(["all", "high", "flagged", "safe"]).default("all"),
});

export type HistoryListQuery = z.infer<typeof historyListQuerySchema>;
export type HistoryFilterMode = HistoryListQuery["filter"];

export function buildHistoryWhere(
  search?: string,
  filter: HistoryFilterMode = "all"
): Prisma.PrescriptionRecordWhereInput {
  const conditions: Prisma.PrescriptionRecordWhereInput[] = [];

  if (search && search.length > 0) {
    conditions.push({
      OR: [
        { patientName: { contains: search, mode: "insensitive" } },
        {
          items: {
            some: { medicationName: { contains: search, mode: "insensitive" } },
          },
        },
      ],
    });
  }

  if (filter === "high") {
    conditions.push({ analysisSeverityLevel: "high" });
  } else if (filter === "flagged") {
    conditions.push(buildFlaggedAnalysisWhere());
  } else if (filter === "safe") {
    conditions.push(buildSafeAnalysisWhere());
  }

  if (conditions.length === 0) {
    return {};
  }

  if (conditions.length === 1) {
    return conditions[0];
  }

  return { AND: conditions };
}
