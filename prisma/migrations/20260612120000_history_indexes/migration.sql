-- CreateIndex
CREATE INDEX "PrescriptionRecord_prescribedAt_idx" ON "PrescriptionRecord"("prescribedAt" DESC);

-- CreateIndex
CREATE INDEX "PrescriptionRecord_patientName_idx" ON "PrescriptionRecord"("patientName");

-- CreateIndex
CREATE INDEX "PrescriptionRecord_analysisSeverityLevel_idx" ON "PrescriptionRecord"("analysisSeverityLevel");

-- CreateIndex
CREATE INDEX "PrescriptionRecord_analysisStatusLabel_idx" ON "PrescriptionRecord"("analysisStatusLabel");
