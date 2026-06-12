import { z } from "zod";
import {
  MAX_DOSAGE_LENGTH,
  MAX_FREQUENCY_LENGTH,
  MAX_PATIENT_NAME_LENGTH,
} from "./constants";

const JUNK_VALUES = new Set([
  "test",
  "asdf",
  "aaa",
  "xxx",
  "xyz",
  "abc",
  "qwerty",
  "dummy",
  "sample",
  "patient",
  "name",
  "drug",
  "medication",
  "na",
  "n/a",
  "none",
  "null",
  "undefined",
]);

const PATIENT_NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}\s'.-]*$/u;
const DRUG_NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}0-9\s./+-]*$/u;
const DOSAGE_PATTERN =
  /^(\d+(\.\d+)?)\s*(mg|g|ml|mcg|µg|iu|unit|units|%|tablet|tablets|tab|tabs|cap|caps|drop|drops|puff|puffs|ug)$/i;

function isJunkValue(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (JUNK_VALUES.has(normalized)) return true;
  if (/^(.)\1{3,}$/.test(normalized)) return true;
  if (/^\d+$/.test(normalized)) return true;
  return false;
}

function hasMinimumLetters(value: string, min = 2): boolean {
  const letters = value.match(/\p{L}/gu);
  return (letters?.length ?? 0) >= min;
}

export function validatePatientName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 2) return "Patient name must be at least 2 characters.";
  if (trimmed.length > MAX_PATIENT_NAME_LENGTH) return "Patient name is too long.";
  if (!PATIENT_NAME_PATTERN.test(trimmed)) {
    return "Patient name may only contain letters, spaces, hyphens, apostrophes, and periods.";
  }
  if (!hasMinimumLetters(trimmed, 2)) {
    return "Patient name must include at least 2 letters.";
  }
  if (isJunkValue(trimmed)) return "Please enter a valid patient name.";
  return null;
}

export function validateDrugName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 2) return "Drug name must be at least 2 characters.";
  if (trimmed.length > MAX_PATIENT_NAME_LENGTH) return "Drug name is too long.";
  if (!DRUG_NAME_PATTERN.test(trimmed)) {
    return "Drug name must start with a letter and contain only letters, numbers, spaces, or common symbols.";
  }
  if (!hasMinimumLetters(trimmed, 2)) {
    return "Drug name must include at least 2 letters.";
  }
  if (isJunkValue(trimmed)) return "Please enter a real medication name.";
  return null;
}

export function validateDosage(dosage: string): string | null {
  const trimmed = dosage.trim();
  if (trimmed.length < 2) return "Dosage is required.";
  if (trimmed.length > MAX_DOSAGE_LENGTH) return "Dosage is too long.";
  if (!DOSAGE_PATTERN.test(trimmed)) {
    return "Dosage must look like a clinical dose (e.g. 10mg, 5 ml, 500mg, 1 tablet).";
  }
  if (isJunkValue(trimmed)) return "Please enter a valid dosage.";
  return null;
}

export function validateFrequency(frequency: string): string | null {
  const trimmed = frequency.trim();
  if (trimmed.length < 2) return "Frequency is required.";
  if (trimmed.length > MAX_FREQUENCY_LENGTH) return "Frequency is too long.";
  if (!/\p{L}/u.test(trimmed)) return "Frequency must include letters.";
  if (isJunkValue(trimmed)) return "Please enter a valid frequency.";
  return null;
}

export function validateMedicationEntry(entry: {
  name: string;
  dosage: string;
  frequency: string;
}): string | null {
  return (
    validateDrugName(entry.name) ??
    validateDosage(entry.dosage) ??
    validateFrequency(entry.frequency)
  );
}

export const clinicalPatientNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(MAX_PATIENT_NAME_LENGTH)
  .superRefine((value, ctx) => {
    const message = validatePatientName(value);
    if (message) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    }
  });

export const clinicalMedicationSchema = z
  .object({
    name: z.string().trim().min(1).max(MAX_PATIENT_NAME_LENGTH),
    dosage: z.string().trim().min(1).max(MAX_DOSAGE_LENGTH),
    frequency: z.string().trim().min(1).max(MAX_FREQUENCY_LENGTH),
  })
  .superRefine((value, ctx) => {
    const nameError = validateDrugName(value.name);
    if (nameError) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["name"], message: nameError });
      return;
    }
    const dosageError = validateDosage(value.dosage);
    if (dosageError) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["dosage"], message: dosageError });
      return;
    }
    const frequencyError = validateFrequency(value.frequency);
    if (frequencyError) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["frequency"], message: frequencyError });
    }
  });
