import { Router, Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { z } from "zod";

const router = Router();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Zod schema for rigorous incoming history data validation
const historySchema = z.object({
  patientName: z.string().min(2, "Patient name must be at least 2 characters."),
  date: z.string().optional(),
  prescriptions: z.array(
    z.object({
      name: z.string().min(1, "Drug name is required."),
      dosage: z.string().min(1, "Dosage is required."),
      frequency: z.string().min(1, "Frequency is required.")
    })
  ).min(1, "At least one prescription drug must be included."),
  aiAnalysis: z.object({
    severity: z.string().optional(),
    severityLevel: z.string().optional(),
    recommendation: z.string().optional(),
    primaryWarning: z.string().optional(),
  }).optional()
});

// GET all History records
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const historyRecords = await prisma.history.findMany({
      include: {
        prescriptions: true,
      },
      orderBy: {
        date: "desc",
      },
      take: 100, // Impose a hard limit to prevent severe DB load on massive histories
    });

    res.status(200).json({ status: "success", data: historyRecords });
  } catch (error) {
    next(error);
  }
});

// POST a new History record (ACID-compliant insert)
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Zod Validation
    const validationResult = historySchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        status: "error", 
        message: "Invalid history payload.", 
        details: validationResult.error.issues 
      });
    }

    const { patientName, date, prescriptions, aiAnalysis } = validationResult.data;

    // 2. ACID-Compliant Transaction Insert
    const newHistory = await prisma.history.create({
      data: {
        patientName,
        date: date ? new Date(date) : undefined,
        aiStatus: aiAnalysis?.severity,
        aiSeverity: aiAnalysis?.severityLevel,
        aiRecommendation: aiAnalysis?.recommendation,
        aiPrimaryWarning: aiAnalysis?.primaryWarning,
        prescriptions: {
          create: prescriptions.map(drug => ({
            name: drug.name,
            dosage: drug.dosage,
            frequency: drug.frequency,
          })),
        },
      },
      include: {
        prescriptions: true,
      },
    });

    res.status(201).json({ status: "success", data: newHistory });
  } catch (error) {
    next(error);
  }
});

export default router;
