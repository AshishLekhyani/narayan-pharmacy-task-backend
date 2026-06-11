import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";

import analyzeRoutes from "./routes/analyze";
import historyRoutes from "./routes/history";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// === 1. Security & HTTP Headers ===
// Helmet sets various HTTP headers to mitigate cross-site scripting, clickjacking, and other exploits.
app.use(helmet());

// === 2. CORS Policy ===
// Lock down cross-origin requests to prevent unauthorized external access.
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

// === 3. Payload Parsers ===
// Limit the JSON payload size to prevent Denial of Service (DoS) via massive payloads.
app.use(express.json({ limit: "1mb" }));

// === 4. Rate Limiting (Global) ===
// Prevent brute-force traffic attacks.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window`
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: { status: "error", message: "Too many requests from this IP, please try again later." }
});
app.use(globalLimiter);

// === 5. Health Check ===
app.get("/health", (req, res) => {
  res.status(200).json({ status: "success", message: "Narayan Pharmacy API is operational." });
});

// === 6. Core API Routes ===
app.use("/api/analyze", analyzeRoutes);
app.use("/api/history", historyRoutes);

// === 7. Global Error Handler Middleware ===
// Catch unhandled route errors and prevent stack trace leakage in production.
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("[Unhandled Server Error]:", err);
  
  const statusCode = err.status || 500;
  const isProd = process.env.NODE_ENV === "production";
  
  res.status(statusCode).json({
    status: "error",
    message: isProd ? "An internal server error occurred." : err.message,
    ...(isProd ? {} : { stack: err.stack })
  });
});

// === 8. Server Initialization ===
app.listen(PORT, () => {
  console.log(`[server]: Clinical Backend running at http://localhost:${PORT}`);
});
