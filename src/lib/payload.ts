/** Normalize legacy request body field names to a single medications array. */
export function pickMedicationList<T>(body: {
  medications?: T[];
  drugs?: T[];
  prescriptions?: T[];
}): T[] {
  return body.medications ?? body.drugs ?? body.prescriptions ?? [];
}
