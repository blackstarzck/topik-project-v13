// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import koMessages from "../../../messages/ko.json";
import { SubmissionFailedModal } from "../../../src/components/writing/SubmissionFailedModal";
import { WRITING_SUBMISSION_BLOCKED_MESSAGE } from "../../../src/lib/writing/submit-errors";
import { WRITING_SUBMISSION_AMBIGUOUS_MESSAGE } from "../../../src/lib/writing/submit-errors";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

afterEach(() => cleanup());

describe("SubmissionFailedModal", () => {
  it("keeps ordinary submit failures retryable", () => {
    const onRetry = vi.fn();
    renderWithIntl(
      <SubmissionFailedModal
        open
        submitError="network down"
        onRetry={onRetry}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("submission-failed-retry"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("routes unavailable problem failures to the problem list instead of retrying", () => {
    const onRetry = vi.fn();
    renderWithIntl(
      <SubmissionFailedModal
        open
        submitError="현재 제출할 수 없는 문제입니다. 다른 문제를 선택해 주세요."
        errorKind="problem_unavailable"
        onRetry={onRetry}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("submission-failed-retry")).toBeNull();
    const problemListLink = screen.getByRole("link", {
      name: koMessages.writing.submit.chooseAnotherProblem,
    });
    expect(problemListLink.getAttribute("href")).toBe("/practice/problems");
  });

  it("shows a localized non-retryable state while runtime submission is blocked", () => {
    renderWithIntl(
      <SubmissionFailedModal
        open
        submitError={WRITING_SUBMISSION_BLOCKED_MESSAGE}
        onRetry={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("submission-failed-retry")).toBeNull();
    expect(
      screen.getByText(koMessages.writing.submit.submissionBlockedTitle),
    ).not.toBeNull();
  });

  it("routes an ambiguous submission to its recovery history without retrying", () => {
    renderWithIntl(
      <SubmissionFailedModal
        open
        submitError={WRITING_SUBMISSION_AMBIGUOUS_MESSAGE}
        onRetry={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("submission-failed-retry")).toBeNull();
    expect(
      screen.getByText(koMessages.writing.submit.submissionAmbiguousTitle),
    ).not.toBeNull();
    const historyLink = screen.getByTestId("submission-failed-history");
    expect(historyLink.tagName).toBe("A");
    expect(historyLink.querySelector("button")).toBeNull();
    expect(historyLink.getAttribute("href")).toBe("/library");
  });
});
