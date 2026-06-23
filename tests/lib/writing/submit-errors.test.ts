import { describe, expect, it } from "vitest";

import {
  WRITING_PROBLEM_NOT_SUBMITTABLE_MESSAGE,
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

  it("keeps ordinary submit failures retryable", () => {
    expect(classifySubmitWritingError("network down")).toBe("retryable");
  });
});
