import crypto from "crypto";

export type MedicationFingerprint = {
  name: string;
  dosage: string;
  frequency: string;
};

export function buildMedicationCacheKey(medications: MedicationFingerprint[]): string {
  const normalized = medications
    .map(
      (m) =>
        `${m.name.toLowerCase().trim()}|${m.dosage.toLowerCase().trim()}|${m.frequency.toLowerCase().trim()}`
    )
    .sort()
    .join("::");
  return crypto.createHash("sha256").update(normalized).digest("hex");
}
