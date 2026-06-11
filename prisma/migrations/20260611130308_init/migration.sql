-- CreateTable
CREATE TABLE "PrescriptionRecord" (
    "id" SERIAL NOT NULL,
    "patientName" TEXT NOT NULL,
    "prescribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "analysisStatusLabel" TEXT,
    "analysisSeverityLevel" TEXT,
    "analysisRecommendation" TEXT,
    "analysisPrimaryWarning" TEXT,
    "analysisClinicalImpact" JSONB,
    "analysisProcessedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrescriptionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrescriptionItem" (
    "id" SERIAL NOT NULL,
    "medicationName" TEXT NOT NULL,
    "dosage" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "prescriptionRecordId" INTEGER NOT NULL,

    CONSTRAINT "PrescriptionItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PrescriptionItem" ADD CONSTRAINT "PrescriptionItem_prescriptionRecordId_fkey" FOREIGN KEY ("prescriptionRecordId") REFERENCES "PrescriptionRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
