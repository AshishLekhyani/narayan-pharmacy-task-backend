import { describe, expect, it } from "vitest";
import { buildHistoryWhere } from "./history-query";

describe("buildHistoryWhere", () => {
  it("returns empty filter for all records", () => {
    expect(buildHistoryWhere(undefined, "all")).toEqual({});
  });

  it("filters critical conflicts by high severity", () => {
    expect(buildHistoryWhere(undefined, "high")).toEqual({
      analysisSeverityLevel: "high",
    });
  });

  it("excludes verified-safe labels from flagged filter", () => {
    expect(buildHistoryWhere(undefined, "flagged")).toEqual({
      analysisSeverityLevel: { not: null },
      NOT: {
        analysisStatusLabel: {
          in: ["Verified Safe", "Low Risk", "Single Medication Review"],
        },
      },
    });
  });

  it("requires low severity and safe labels for safe filter", () => {
    expect(buildHistoryWhere(undefined, "safe")).toEqual({
      analysisSeverityLevel: "low",
      analysisStatusLabel: {
        in: ["Verified Safe", "Low Risk", "Single Medication Review"],
      },
    });
  });

  it("combines search with severity filter", () => {
    const where = buildHistoryWhere("aspirin", "high");
    expect(where).toHaveProperty("AND");
  });
});
