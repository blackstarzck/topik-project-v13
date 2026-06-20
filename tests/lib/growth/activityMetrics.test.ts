import { describe, expect, it } from "vitest";
import { mergeAttemptCounts } from "../../../src/lib/growth/activityMetrics";

describe("mergeAttemptCounts", () => {
  it("uses the larger DB-backed count without double-counting both sources", () => {
    expect(
      mergeAttemptCounts({
        problemAttemptCount: 4,
        studyEventCount: 7,
      }),
    ).toBe(7);

    expect(
      mergeAttemptCounts({
        problemAttemptCount: 9,
        studyEventCount: 3,
      }),
    ).toBe(9);
  });

  it("treats missing or invalid counts as zero", () => {
    expect(
      mergeAttemptCounts({
        problemAttemptCount: null,
        studyEventCount: Number.NaN,
      }),
    ).toBe(0);
  });
});
