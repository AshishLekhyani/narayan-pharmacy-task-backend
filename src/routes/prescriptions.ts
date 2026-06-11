import { Router, Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { z } from "zod";

const router = Router();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Zod schema for rigorous incoming prescription data validation
const prescriptionSchema = z.object({
  patientName: z.string().min(2, "Patient name must be at least 2 characters."),
  doctorName: z.string().min(2, "Doctor name must be at least 2 characters."),
  date: z.string().optional(),
  medications: z.array(
    z.object({
      name: z.string().min(1, "Medication name is required."),
      dosage: z.string().min(1, "Dosage is required."),
      frequency: z.string().min(1, "Frequency is required.")
    })
  ).min(1, "At least one medication must be included."),
  aiAnalysis: z.object({
    severity: z.string().optional(),
    severityLevel: z.string().optional(),
    recommendation: z.string().optional(),
    primaryWarning: z.string().optional(),
  }).optional()
});

// GET all prescriptions (Hydrates History Page)
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prescriptions = await prisma.prescription.findMany({
      include: {
        medications: true,
      },
      orderBy: {
        date: "desc",
      },
      take: 100, // Impose a hard limit to prevent severe DB load on massive histories
    });

    res.status(200).json({ status: "success", data: prescriptions });
  } catch (error) {
    next(error);
  }
});

// POST a new prescription (ACID-compliant insert)
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Zod Validation (Defensive programming barrier)
    const validationResult = prescriptionSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        status: "error", 
        message: "Invalid prescription payload.", 
        details: validationResult.error.issues 
      });
    }

    const { patientName, doctorName, date, medications, aiAnalysis } = validationResult.data;

    // 2. ACID-Compliant Transaction Insert
    const newPrescription = await prisma.prescription.create({
      data: {
        patientName,
        doctorName,
        date: date ? new Date(date) : undefined,
        aiStatus: aiAnalysis?.severity,
        aiSeverity: aiAnalysis?.severityLevel,
        aiRecommendation: aiAnalysis?.recommendation,
        aiPrimaryWarning: aiAnalysis?.primaryWarning,
        medications: {
          create: medications.map(med => ({
            name: med.name,
            dosage: med.dosage,
            frequency: med.frequency,
          })),
        },
      },
      include: {
        medications: true,
      },
    });

    res.status(201).json({ status: "success", data: newPrescription });
  } catch (error) {
    next(error);
  }
});

export default router;
