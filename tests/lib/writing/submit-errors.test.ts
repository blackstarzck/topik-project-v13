import { describe, expect, it } from "vitest";

import {
  WRITING_PROBLEM_NOT_SUBMITTABLE_MESSAGE,
  WRITING_SUBMISSION_AMBIGUOUS_MESSAGE,
  WRITING_SUBMISSION_BLOCKED_MESSAGE,
  WRITING_SUBMISSION_DRAFT_REQUIRED_MESSAGE,
  classifySubmitWritingError,
  toSubmitWritingErrorMessage,
} from "../../../src/lib/writing/submit-errors";

describe("writing submit errors", () => {
  it("normalizes the DB guard error into a learner-facing unavailable message", () => {
    expect(toSubmitWritingErrorMessage("problem_not_submittable")).toBe(
      WRITING_PROBLEM_NOT_SUBMITTABLE_MESSAGE,
    );
  });

  it("classifies unavailable problem errors as non-retryable in-place", () => {
    expect(
      classifySubmitWritingError(WRITING_PROBLEM_NOT_SUBMITTABLE_MESSAGE),
    ).toBe("problem_unavailable");
  });

  it("normalizes and classifies the runtime submission block for learners", () => {
    expect(
      toSubmitWritingErrorMessage("writing_submission_temporarily_blocked"),
    ).toBe(WRITING_SUBMISSION_BLOCKED_MESSAGE);
    expect(classifySubmitWritingError(WRITING_SUBMISSION_BLOCKED_MESSAGE)).toBe(
      "submission_blocked",
    );
  });

  it("keeps ordinary submit failures retryable", () => {
    expect(classifySubmitWritingError("network down")).toBe("retryable");
  });

  it("blocks automatic retry when provider acceptance is ambiguous", () => {
    expect(
      toSubmitWritingErrorMessage("writing_submission_dispatch_ambiguous"),
    ).toBe(WRITING_SUBMISSION_AMBIGUOUS_MESSAGE);
    expect(
      classifySubmitWritingError(WRITING_SUBMISSION_AMBIGUOUS_MESSAGE),
    ).toBe("submission_ambiguous");
  });

  it("explains that a durable draft is required before dispatch", () => {
    expect(
      toSubmitWritingErrorMessage("writing_submission_draft_required"),
    ).toBe(WRITING_SUBMISSION_DRAFT_REQUIRED_MESSAGE);
    expect(
      classifySubmitWritingError(WRITING_SUBMISSION_DRAFT_REQUIRED_MESSAGE),
    ).toBe("retryable");
  });
});
