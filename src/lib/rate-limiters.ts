import rateLimit from "express-rate-limit";

/** Shared limiter for Claude-backed and rules-engine analysis routes (per IP). */
export const aiAnalysisLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    status: "error",
    message: "AI Analysis rate limit exceeded. Please wait before retrying.",
  },
});
