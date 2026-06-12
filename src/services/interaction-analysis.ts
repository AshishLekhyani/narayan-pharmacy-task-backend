import Anthropic from "@anthropic-ai/sdk";
import {
  ANALYSIS_JSON_REPAIR_PROMPT,
  parseModelAnalysisText,
  type AnalysisResultDto,
} from "../lib/analysis-response";
import {
  buildMedicationCacheKey,
  readCachedAnalysis,
  writeCachedAnalysis,
} from "../lib/analyze-cache";
import { buildPharmacyPrompt } from "../lib/analyze-prompt";
import type { MedicationInput } from "../lib/medication-input";
import { buildSingleDrugAnalysis } from "../lib/single-drug-analysis";

const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const AI_REQUEST_TIMEOUT_MS = 90_000;

export type { MedicationInput };

/** Coalesce concurrent identical combo requests into one Claude call. */
const inFlightAnalysis = new Map<string, Promise<InteractionAnalysisResult>>();

export type InteractionAnalysisResult = {
  analysis: AnalysisResultDto;
  cachedResult: boolean;
  localResult: boolean;
};

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AnalysisServiceError(
      503,
      "AI Integration is not configured. Please set ANTHROPIC_API_KEY on the server."
    );
  }
  return new Anthropic({ apiKey });
}

export class AnalysisServiceError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "AnalysisServiceError";
  }
}

export function mapAnthropicError(error: unknown): AnalysisServiceError | null {
  if (error instanceof AnalysisServiceError) {
    return error;
  }

  if (error instanceof Anthropic.APIError) {
    if (error.status === 401) {
      return new AnalysisServiceError(
        503,
        "AI service authentication failed. Verify ANTHROPIC_API_KEY on the server."
      );
    }
    if (error.status === 404) {
      return new AnalysisServiceError(
        503,
        `AI model "${CLAUDE_MODEL}" is unavailable. Set ANTHROPIC_MODEL in server env to a model your account can access.`
      );
    }
    if (error.status === 429) {
      return new AnalysisServiceError(503, "AI service is temporarily busy. Please wait a moment and try again.");
    }
    if (error.status === 529 || error.status === 503) {
      return new AnalysisServiceError(503, "AI service is temporarily overloaded. Please try again shortly.");
    }
    return new AnalysisServiceError(502, "AI service returned an error. Please try again.");
  }

  if (
    error instanceof Error &&
    (error.name === "AbortError" || error.message.toLowerCase().includes("timeout"))
  ) {
    return new AnalysisServiceError(504, "AI analysis timed out. Please try again.");
  }

  return null;
}

export async function runInteractionAnalysis(
  medications: MedicationInput[]
): Promise<InteractionAnalysisResult> {
  if (medications.length === 0) {
    throw new AnalysisServiceError(400, "Add at least one medication before running analysis.");
  }

  if (medications.length === 1) {
    return {
      analysis: buildSingleDrugAnalysis(medications[0]),
      cachedResult: false,
      localResult: true,
    };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AnalysisServiceError(
      503,
      "AI Integration is not configured. Please set ANTHROPIC_API_KEY on the server."
    );
  }

  const cacheKey = buildMedicationCacheKey(medications);

  try {
    const cachedResult = await readCachedAnalysis(cacheKey);
    if (cachedResult) {
      return { analysis: cachedResult, cachedResult: true, localResult: false };
    }
  } catch (cacheError) {
    console.error("[Cache Read Error]:", cacheError);
  }

  const pending = inFlightAnalysis.get(cacheKey);
  if (pending) {
    return pending;
  }

  const analysisPromise = runClaudeInteractionAnalysis(medications, cacheKey);
  inFlightAnalysis.set(cacheKey, analysisPromise);

  try {
    return await analysisPromise;
  } finally {
    inFlightAnalysis.delete(cacheKey);
  }
}

const JSON_ONLY_SYSTEM_PROMPT =
  'You are a JSON-only clinical drug-interaction engine for Narayan Pharmacy (US-based pharmacy). Use US drug nomenclature and FDA-oriented dispensing standards. Output exactly one JSON object with fields: severityLevel ("high"|"low"), severity (Critical Conflict|Potential Interaction|Low Risk|Verified Safe|Drug Identification Required), primaryWarning, recommendation, clinicalImpact (2-4 strings), processedBy ("Claude API — Narayan Pharmacy DDI Engine (US)"). No markdown. No text outside JSON.';

async function requestClaudeAnalysis(
  anthropic: Anthropic,
  medications: MedicationInput[],
  signal: AbortSignal,
  repairContext?: { assistantText: string }
): Promise<string> {
  const messages: Anthropic.MessageParam[] = repairContext
    ? [
        { role: "user", content: buildPharmacyPrompt(medications) },
        { role: "assistant", content: repairContext.assistantText },
        { role: "user", content: ANALYSIS_JSON_REPAIR_PROMPT },
      ]
    : [{ role: "user", content: buildPharmacyPrompt(medications) }];

  const message = await anthropic.messages.create(
    {
      model: CLAUDE_MODEL,
      max_tokens: 1536,
      temperature: 0,
      system: JSON_ONLY_SYSTEM_PROMPT,
      messages,
    },
    { signal }
  );

  const firstBlock = message.content[0];
  if (!firstBlock || firstBlock.type !== "text") {
    throw new AnalysisServiceError(502, "AI Gateway returned an unsupported response format.");
  }

  return firstBlock.text;
}

async function runClaudeInteractionAnalysis(
  medications: MedicationInput[],
  cacheKey: string
): Promise<InteractionAnalysisResult> {
  const anthropic = getAnthropicClient();
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), AI_REQUEST_TIMEOUT_MS);

  let parsedResult: AnalysisResultDto;
  try {
    const initialText = await requestClaudeAnalysis(
      anthropic,
      medications,
      abortController.signal
    );

    try {
      parsedResult = parseModelAnalysisText(initialText);
    } catch (firstParseError) {
      console.warn("[Claude Parse Error] Retrying once with repair prompt:", firstParseError);
      const repairedText = await requestClaudeAnalysis(anthropic, medications, abortController.signal, {
        assistantText: initialText,
      });
      parsedResult = parseModelAnalysisText(repairedText);
    }
  } catch (error) {
    if (error instanceof AnalysisServiceError) {
      throw error;
    }
    console.error("[Claude Parse Error]:", error);
    throw new AnalysisServiceError(
      502,
      "AI Gateway returned an unparseable clinical report. Please try again."
    );
  } finally {
    clearTimeout(timeoutId);
  }

  try {
    await writeCachedAnalysis(cacheKey, parsedResult);
  } catch (cacheWriteError) {
    console.error("[Cache Write Error]:", cacheWriteError);
  }

  return { analysis: parsedResult, cachedResult: false, localResult: false };
}
