import { Router, Request, Response, NextFunction } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import { prisma } from "../lib/database";

const router = Router();
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

// === Schema ===
const medicationEntrySchema = z.object({
  name: z.string().trim().min(1, "Drug name is required"),
  dosage: z.string().trim().min(1, "Dosage is required"),
  frequency: z.string().trim().min(1, "Frequency is required"),
});

const analyzeSchema = z
  .object({
    drugs: z.array(medicationEntrySchema).optional(),
    medications: z.array(medicationEntrySchema).optional(),
  })
  .superRefine((val, ctx) => {
    const list = val.medications ?? val.drugs ?? [];
    if (list.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["medications"],
        message: "At least 2 medications are required for an interaction check.",
      });
    }
  });

// === Rate Limiter ===
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 10,
  message: { status: "error", message: "AI Analysis rate limit exceeded. Please wait before retrying." },
});

// === Helpers ===

/**
 * Builds a deterministic cache key from the medication list.
 * Sorts alphabetically so order doesn't matter (Warfarin+Aspirin === Aspirin+Warfarin).
 */
function buildCacheKey(
  medications: Array<{ name: string; dosage: string; frequency: string }>
): string {
  const normalized = medications
    .map((m) => `${m.name.toLowerCase().trim()}|${m.dosage.toLowerCase().trim()}|${m.frequency.toLowerCase().trim()}`)
    .sort()
    .join("::");
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

// === Route ===
router.post("/", aiLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Validate payload
    const validationResult = analyzeSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        status: "error",
        message: validationResult.error.issues[0]?.message ?? "Malformed payload structure.",
        details: validationResult.error.issues,
      });
    }

    const medications = validationResult.data.medications ?? validationResult.data.drugs ?? [];

    // 2. Check API key before doing DB or AI work
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({
        status: "error",
        message: "AI Integration is not configured. Please set ANTHROPIC_API_KEY on the server.",
      });
    }

    // 3. DB cache lookup — skip Claude if we've already analyzed this exact combination
    const cacheKey = buildCacheKey(medications);
    const cached = await prisma.analysisCache.findUnique({ where: { cacheKey } });

    if (cached) {
      // Bump hit count in the background (fire and forget)
      prisma.analysisCache
        .update({ where: { cacheKey }, data: { hitCount: { increment: 1 } } })
        .catch(() => {}); // Non-critical, never block the response

      return res.status(200).json({ ...cached.result as object, cachedResult: true });
    }

    // 4. Build a pharmacy-specific, clinically rigorous prompt
    const drugListString = medications
      .map((m, i) => `  ${i + 1}. ${m.name} — ${m.dosage}, ${m.frequency}`)
      .join("\n");

    const prompt = `You are a clinical pharmacist AI integrated into a pharmacy dispensing system called Narayan Pharmacy.
A pharmacist has entered the following concurrent medications for a single patient. Your task is to assess drug-drug interactions (DDIs) using established pharmacokinetic and pharmacodynamic principles.

Medications prescribed:
${drugListString}

Evaluate:
- Known or theoretical DDIs (e.g. CYP450 enzyme inhibition/induction, additive toxicity, antagonism)
- Contraindications based on drug classes and mechanisms of action
- Clinical severity of any interactions (no interaction, minor, moderate, major, contraindicated)
- A concise evidence-based recommendation for the dispensing pharmacist

Respond ONLY with a valid JSON object in exactly this format, with no markdown fencing, no preamble, and no trailing text:
{
  "severityLevel": "high" | "low",
  "severity": "Critical Conflict" | "Potential Interaction" | "Low Risk" | "Verified Safe",
  "primaryWarning": "<one sentence identifying the primary drug pair and the nature of the interaction>",
  "recommendation": "<one to two sentences of actionable clinical guidance for the dispensing pharmacist>",
  "clinicalImpact": ["<specific pharmacokinetic or pharmacodynamic effect>", "<clinical consequence for the patient>"],
  "processedBy": "Claude API — Narayan Pharmacy DDI Engine"
}`;

    // 5. Call Claude
    const message = await anthropic.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 1024,
      temperature: 0,
      system:
        "You are a specialized JSON-only clinical drug interaction engine integrated into a retail pharmacy platform. Never output markdown. Never explain yourself. Output only a valid JSON object.",
      messages: [{ role: "user", content: prompt }],
    });

    const firstBlock = message.content[0];
    if (firstBlock.type !== "text") {
      return res.status(502).json({
        status: "error",
        message: "AI Gateway returned an unsupported response format.",
      });
    }

    // 6. Parse Claude's response
    let parsedResult: object;
    try {
      parsedResult = JSON.parse(firstBlock.text);
    } catch {
      console.error("[Claude Parse Error]: Output was not valid JSON.\n", firstBlock.text);
      return res.status(502).json({
        status: "error",
        message: "AI Gateway returned an unparseable response. Please try again.",
      });
    }

    // 7. Persist to cache (non-blocking — don't fail the response if this errors)
    prisma.analysisCache
      .create({ data: { cacheKey, result: parsedResult } })
      .catch((err) => console.error("[Cache Write Error]:", err));

    return res.status(200).json({ ...parsedResult, cachedResult: false });
  } catch (error) {
    next(error);
  }
});

export default router;
