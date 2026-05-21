import { describe, expect, it } from "vitest";
import {
  comparisonReportKey,
  draftQueryKey,
  feedbackBundleKey,
  feedbackStatusKey,
  submissionQueryKey,
} from "../../../src/lib/writing/queries";

describe("writing query keys", () => {
  it("draftQueryKey is stable", () => {
    expect(draftQueryKey("u", "p")).toEqual(["writing-draft", "u", "p"]);
  });
  it("submissionQueryKey is stable", () => {
    expect(submissionQueryKey("s")).toEqual(["writing-submission", "s"]);
  });
  it("feedbackBundleKey is stable", () => {
    expect(feedbackBundleKey("s")).toEqual([
      "writing-feedback-bundle",
      "s",
    ]);
  });
  it("feedbackStatusKey is stable", () => {
    expect(feedbackStatusKey("s")).toEqual([
      "writing-feedback-status",
      "s",
    ]);
  });
  it("comparisonReportKey is stable", () => {
    expect(comparisonReportKey("r")).toEqual([
      "writing-comparison-report",
      "r",
    ]);
  });
});
