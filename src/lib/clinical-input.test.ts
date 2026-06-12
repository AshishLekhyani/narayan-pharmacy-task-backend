import { describe, expect, it } from "vitest";
import {
  clinicalMedicationSchema,
  validateDrugName,
  validateDosage,
  validateFrequency,
  validatePatientName,
  validatePrescriptionDate,
} from "./clinical-input";

describe("validatePatientName", () => {
  it("accepts a realistic Indian patient name", () => {
    expect(validatePatientName("Rajesh Kumar")).toBeNull();
  });

  it("rejects junk placeholders", () => {
    expect(validatePatientName("test")).toMatch(/valid patient/i);
    expect(validatePatientName("null")).toMatch(/valid patient/i);
  });
});

describe("validateDrugName", () => {
  it("accepts common drug names", () => {
    expect(validateDrugName("Paracetamol")).toBeNull();
    expect(validateDrugName("Metformin 500")).toBeNull();
  });

  it("rejects fictional junk", () => {
    expect(validateDrugName("asdf")).toMatch(/real medication/i);
    expect(validateDrugName("undefined")).toMatch(/real medication/i);
  });
});

describe("validateDosage", () => {
  it("accepts clinical dose formats", () => {
    expect(validateDosage("10mg")).toBeNull();
    expect(validateDosage("5 ml")).toBeNull();
    expect(validateDosage("1 tablet")).toBeNull();
  });

  it("rejects non-dose strings", () => {
    expect(validateDosage("lots")).toMatch(/clinical dose/i);
  });
});

describe("validateFrequency", () => {
  it("accepts OD/BD style frequencies", () => {
    expect(validateFrequency("BD (Twice Daily)")).toBeNull();
  });

  it("rejects junk", () => {
    expect(validateFrequency("xxx")).toMatch(/valid frequency/i);
  });
});

describe("validatePrescriptionDate", () => {
  it("accepts today", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(validatePrescriptionDate(today)).toBeNull();
  });

  it("rejects future dates", () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    expect(validatePrescriptionDate(future.toISOString().slice(0, 10))).toMatch(/future/i);
  });

  it("rejects dates before 1900", () => {
    expect(validatePrescriptionDate("1899-12-31")).toMatch(/past/i);
  });
});

describe("clinicalMedicationSchema", () => {
  it("attaches field-level paths for invalid dosage", () => {
    const result = clinicalMedicationSchema.safeParse({
      name: "Aspirin",
      dosage: "invalid",
      frequency: "OD (Once Daily)",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["dosage"]);
    }
  });
});
