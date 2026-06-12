import { prisma } from "./database";
import { buildFlaggedAnalysisWhere, buildSafeAnalysisWhere } from "./history-filters";

export type HistoryGlobalStats = {
  totalRecords: number;
  severeAlerts: number;
  aiFlagged: number;
  validationRate: number;
};

export async function getGlobalHistoryStats(): Promise<HistoryGlobalStats> {
  const [totalRecords, severeAlerts, aiFlagged, safeCount] = await Promise.all([
    prisma.prescriptionRecord.count(),
    prisma.prescriptionRecord.count({ where: { analysisSeverityLevel: "high" } }),
    prisma.prescriptionRecord.count({ where: buildFlaggedAnalysisWhere() }),
    prisma.prescriptionRecord.count({ where: buildSafeAnalysisWhere() }),
  ]);

  const validationRate =
    totalRecords === 0 ? 0 : Math.round((safeCount / totalRecords) * 1000) / 10;

  return { totalRecords, severeAlerts, aiFlagged, validationRate };
}
