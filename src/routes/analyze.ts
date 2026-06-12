import { Router, Request, Response, NextFunction } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import { prisma } from "../lib/database";
import {
  extractJsonFromModelText,
  parseAnalysisResult,
  toPublicAnalysisResponse,
} from "../lib/analysis-response";
import { clinicalMedicationSchema } from "../lib/clinical-input";

const router = Router();
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

const analyzeSchema = z
  .object({
    drugs: z.array(clinicalMedicationSchema).max(50).optional(),
    medications: z.array(clinicalMedicationSchema).max(50).optional(),
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

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { status: "error", message: "AI Analysis rate limit exceeded. Please wait before retrying." },
});

function buildCacheKey(
  medications: Array<{ name: string; dosage: string; frequency: string }>
): string {
  const normalized = medications
    .map((m) => `${m.name.toLowerCase().trim()}|${m.dosage.toLowerCase().trim()}|${m.frequency.toLowerCase().trim()}`)
    .sort()
    .join("::");
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

function buildPharmacyPrompt(
  medications: Array<{ name: string; dosage: string; frequency: string }>
): string {
  const drugListString = medications
    .map((m, i) => `  ${i + 1}. ${m.name} — ${m.dosage}, ${m.frequency}`)
    .join("\n");

  return `You are the clinical drug-interaction engine for Narayan Pharmacy, a dispensing pharmacy serving patients in India.

A licensed pharmacist has entered the following concurrent medications for ONE patient. Evaluate them as a combined regimen before dispensing.

Medications on this prescription:
${drugListString}

Your assessment must consider:
- Established and theoretical drug-drug interactions (DDIs)
- CYP450 inhibition/induction, protein binding displacement, QT prolongation, bleeding risk, hypotension, hyperkalaemia, serotonin syndrome, and additive organ toxicity
- Indian pharmacy realities: brand/generic name variants, common OTC co-prescriptions (e.g. aspirin, PPIs, paracetamol), and regional prescribing patterns (OD/BD/TDS/QID/SOS)
- Whether the combination is safe to dispense as written, requires counselling, dose adjustment, monitoring, or pharmacist escalation

Severity guidance:
- "high" / "Critical Conflict" — major or contraindicated interaction; do not dispense without pharmacist review
- "low" / "Potential Interaction" or "Low Risk" — minor/moderate concern with actionable counselling
- "Verified Safe" — no clinically meaningful interaction identified for this combination
- "Drug Identification Required" — use when any drug name is unrecognizable, clearly fictional, or cannot be mapped to a known generic/brand; do NOT invent interactions for mystery drugs

Unrecognized or made-up drug names:
- If you cannot confidently identify a drug as a real medication (allowing common Indian brand/generic spelling variants), you MUST NOT fabricate drug-drug interactions involving it.
- Return severityLevel "low", severity "Drug Identification Required", name the unverified drug(s) in primaryWarning, and recommend spelling verification, prescriber callback, and holding dispensing until the agent is confirmed.

Respond ONLY with a valid JSON object — no markdown fences, no commentary, no trailing text:
{
  "severityLevel": "high" | "low",
  "severity": "Critical Conflict" | "Potential Interaction" | "Low Risk" | "Verified Safe" | "Drug Identification Required",
  "primaryWarning": "<one sentence naming the key drug pair and interaction mechanism>",
  "recommendation": "<one to two sentences of practical dispensing guidance for the Narayan Pharmacy pharmacist>",
  "clinicalImpact": ["<pharmacological mechanism>", "<patient-facing clinical consequence>"],
  "processedBy": "Claude API — Narayan Pharmacy DDI Engine"
}`;
}

function mapAnthropicError(error: unknown): { status: number; message: string } | null {
  if (error instanceof Anthropic.APIError) {
    if (error.status === 401) {
      return { status: 503, message: "AI service authentication failed. Verify ANTHROPIC_API_KEY on the server." };
    }
    if (error.status === 404) {
      return {
        status: 503,
        message: `AI model "${CLAUDE_MODEL}" is unavailable. Set ANTHROPIC_MODEL in server env to a model your account can access.`,
      };
    }
    if (error.status === 429) {
      return { status: 503, message: "AI service is temporarily busy. Please wait a moment and try again." };
    }
    if (error.status === 529 || error.status === 503) {
      return { status: 503, message: "AI service is temporarily overloaded. Please try again shortly." };
    }
    return { status: 502, message: "AI service returned an error. Please try again." };
  }

  if (error instanceof Error && error.message.toLowerCase().includes("timeout")) {
    return { status: 504, message: "AI analysis timed out. Please try again." };
  }

  return null;
}

router.post("/", aiLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validationResult = analyzeSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        status: "error",
        message: validationResult.error.issues[0]?.message ?? "Malformed payload structure.",
      });
    }

    const medications = validationResult.data.medications ?? validationResult.data.drugs ?? [];

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({
        status: "error",
        message: "AI Integration is not configured. Please set ANTHROPIC_API_KEY on the server.",
      });
    }

    const cacheKey = buildCacheKey(medications);

    try {
      const cached = await prisma.analysisCache.findUnique({ where: { cacheKey } });
      if (cached) {
        prisma.analysisCache
          .update({ where: { cacheKey }, data: { hitCount: { increment: 1 } } })
          .catch(() => {});

        const cachedResult = parseAnalysisResult(cached.result);
        return res.status(200).json(toPublicAnalysisResponse(cachedResult, true));
      }
    } catch (cacheError) {
      console.error("[Cache Read Error]:", cacheError);
      // Fall through to live Claude call — cache failure must not block analysis
    }

    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      temperature: 0,
      system:
        "You are a JSON-only clinical drug interaction engine for Narayan Pharmacy. Output exactly one valid JSON object. Never use markdown. Never add prose outside the JSON.",
      messages: [{ role: "user", content: buildPharmacyPrompt(medications) }],
    });

    const firstBlock = message.content[0];
    if (!firstBlock || firstBlock.type !== "text") {
      return res.status(502).json({
        status: "error",
        message: "AI Gateway returned an unsupported response format.",
      });
    }

    let parsedResult;
    try {
      const rawJson = extractJsonFromModelText(firstBlock.text);
      parsedResult = parseAnalysisResult(rawJson);
    } catch (parseError) {
      console.error("[Claude Parse Error]:", parseError, "\nRaw output:\n", firstBlock.text);
      return res.status(502).json({
        status: "error",
        message: "AI Gateway returned an unparseable clinical report. Please try again.",
      });
    }

    try {
      await prisma.analysisCache.upsert({
        where: { cacheKey },
        create: { cacheKey, result: parsedResult },
        update: { result: parsedResult },
      });
    } catch (cacheWriteError) {
      console.error("[Cache Write Error]:", cacheWriteError);
    }

    return res.status(200).json(toPublicAnalysisResponse(parsedResult, false));
  } catch (error) {
    const mapped = mapAnthropicError(error);
    if (mapped) {
      return res.status(mapped.status).json({ status: "error", message: mapped.message });
    }
    next(error);
  }
});

export default router;
