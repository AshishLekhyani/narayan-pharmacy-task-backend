import crypto from "crypto";
import { ANALYSIS_PROMPT_VERSION } from "./analyze-prompt";

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
  return crypto
    .createHash("sha256")
    .update(`${ANALYSIS_PROMPT_VERSION}::${normalized}`)
    .digest("hex");
}
