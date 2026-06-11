import { Router, Request, Response, NextFunction } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import rateLimit from "express-rate-limit";

const router = Router();
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "", 
});

// Zod Schema for strict input boundary validation
const analyzeSchema = z.object({
  drugs: z.array(
    z.object({
      name: z.string().min(1, "Drug name is required"),
      dosage: z.string().min(1, "Dosage is required"),
      frequency: z.string().min(1, "Frequency is required")
    })
  ).min(1, "At least one drug must be provided for analysis.")
});

// AI endpoints are expensive; apply stricter rate limiting
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Max 10 interaction checks per minute per IP
  message: { status: "error", message: "AI Analysis rate limit exceeded." }
});

router.post("/", aiLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Defensively validate incoming payload utilizing Zod
    const validationResult = analyzeSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        status: "error", 
        message: "Malformed payload structure.", 
        details: validationResult.error.errors 
      });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ status: "error", message: "AI Integration service is currently unavailable." });
    }

    const { drugs } = validationResult.data;
    const drugListString = drugs.map(d => `${d.name} (${d.dosage}, ${d.frequency})`).join("\n");

    const prompt = `You are a strict, highly conservative clinical pharmacologist API.
Analyze the following list of medications for a single patient:
${drugListString}

Respond STRICTLY in valid JSON format with the following schema:
{
  "severityLevel": "high" | "low",
  "severity": "Critical Conflict" | "Potential Interaction" | "Low Risk" | "Verified Safe",
  "primaryWarning": "A 1-sentence summary of the primary concern",
  "recommendation": "A 1-2 sentence actionable clinical recommendation",
  "clinicalImpact": ["bullet 1", "bullet 2"],
  "processedBy": "Claude 3 API"
}

Do NOT output any markdown blocks or conversational text. Output ONLY the raw JSON object.`;

    const message = await anthropic.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 1024,
      temperature: 0,
      system: "You are a specialized JSON-only clinical pharmacokinetics evaluation engine.",
      messages: [{ role: "user", content: prompt }],
    });

    const responseText = (message.content[0] as any).text;
    
    // Attempt to parse the JSON returned by Claude safely
    try {
      const parsedData = JSON.parse(responseText);
      res.status(200).json(parsedData);
    } catch (parseError) {
      console.error("[Claude Parse Error]: Output was not valid JSON.", responseText);
      res.status(502).json({ status: "error", message: "AI Gateway returned an unparseable structural response." });
    }

  } catch (error) {
    // Pass unexpected errors down to the global error middleware
    next(error);
  }
});

export default router;
