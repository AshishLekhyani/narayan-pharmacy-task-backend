-- CreateTable
CREATE TABLE "Prescription" (
    "id" SERIAL NOT NULL,
    "patientName" TEXT NOT NULL,
    "doctorName" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aiStatus" TEXT,
    "aiSeverity" TEXT,
    "aiRecommendation" TEXT,
    "aiPrimaryWarning" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medication" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "dosage" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "prescriptionId" INTEGER NOT NULL,

    CONSTRAINT "Medication_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Medication" ADD CONSTRAINT "Medication_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
