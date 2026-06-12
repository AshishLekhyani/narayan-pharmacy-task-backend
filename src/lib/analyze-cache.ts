import { prisma } from "./database";
import { parseAnalysisResult, type AnalysisResultDto } from "./analysis-response";
import { buildMedicationCacheKey, type MedicationFingerprint } from "./analyze-cache-key";

export { buildMedicationCacheKey, type MedicationFingerprint };

export async function readCachedAnalysis(
  cacheKey: string
): Promise<AnalysisResultDto | null> {
  const cached = await prisma.analysisCache.findUnique({ where: { cacheKey } });
  if (!cached) return null;

  prisma.analysisCache
    .update({ where: { cacheKey }, data: { hitCount: { increment: 1 } } })
    .catch((err) => console.error("[Cache HitCount Error]:", err));

  return parseAnalysisResult(cached.result);
}

export async function writeCachedAnalysis(
  cacheKey: string,
  result: AnalysisResultDto
): Promise<void> {
  await prisma.analysisCache.upsert({
    where: { cacheKey },
    create: { cacheKey, result },
    update: { result },
  });
}
