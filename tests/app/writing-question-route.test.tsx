// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const requireUserMock = vi.hoisted(() => vi.fn());
const getWritingProblemMock = vi.hoisted(() => vi.fn());
const getActiveDraftMock = vi.hoisted(() => vi.fn());
const getRetrySubmissionSeedMock = vi.hoisted(() => vi.fn());
const getComparisonReportMock = vi.hoisted(() => vi.fn());
const getSubmissionMock = vi.hoisted(() => vi.fn());
const writingPageContentMock = vi.hoisted(() => vi.fn());

vi.mock("next-intl/server", () => ({
  getTranslations: () => async (key: string) => key,
}));

vi.mock("@/components/writing/WritingPageContent", () => ({
  WritingPageContent: (props: unknown) => {
    writingPageContentMock(props);
    return <div data-testid="writing-page-content" />;
  },
}));

vi.mock("@/lib/auth/session", () => ({
  requireUser: () => requireUserMock(),
}));

vi.mock("@/lib/writing/server", () => ({
  getWritingProblem: (...args: unknown[]) => getWritingProblemMock(...args),
  getActiveDraft: (...args: unknown[]) => getActiveDraftMock(...args),
  getRetrySubmissionSeed: (...args: unknown[]) =>
    getRetrySubmissionSeedMock(...args),
  getComparisonReport: (...args: unknown[]) =>
    getComparisonReportMock(...args),
  getSubmission: (...args: unknown[]) => getSubmissionMock(...args),
  isProblemIdLikeUuid: (value: unknown) =>
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    ),
}));

import { renderWritingQuestionPage } from "../../src/app/(workspace)/writing/_components/WritingQuestionRoute";

describe("renderWritingQuestionPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("passes the authenticated user id into default writing problem selection", async () => {
    requireUserMock.mockResolvedValue({ id: "user-1" });
    getWritingProblemMock.mockResolvedValue(null);

    const element = await renderWritingQuestionPage(51, Promise.resolve({}));
    render(element);

    expect(getWritingProblemMock).toHaveBeenCalledWith(
      51,
      undefined,
      undefined,
      {
        userId: "user-1",
      },
    );
    expect(getActiveDraftMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("writing-page-content")).toBeTruthy();
  });

  it("passes a validated contextual return target to the writing content", async () => {
    requireUserMock.mockResolvedValue({ id: "user-1" });
    getWritingProblemMock.mockResolvedValue(null);

    const element = await renderWritingQuestionPage(
      53,
      Promise.resolve({
        problem: "problem-1",
        returnTo: "/practice/problems?type=long&page=2#results",
      }),
    );
    render(element);

    expect(writingPageContentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        returnHref: "/practice/problems?type=long&page=2#results",
      }),
    );
  });

  it.each([
    {},
    { returnTo: "https://evil.example/dashboard" },
    { returnTo: ["/dashboard", "/library"] },
  ])("uses the problem list for a missing or unsafe return target", async (searchParams) => {
    requireUserMock.mockResolvedValue({ id: "user-1" });
    getWritingProblemMock.mockResolvedValue(null);

    const element = await renderWritingQuestionPage(
      51,
      Promise.resolve(searchParams),
    );
    render(element);

    expect(writingPageContentMock).toHaveBeenCalledWith(
      expect.objectContaining({ returnHref: "/practice/problems" }),
    );
  });

  it("accepts only the current feedback as a retry return target", async () => {
    const problemId = "00000000-0000-4000-8000-000000000051";
    const submissionId = "00000000-0000-4000-8000-000000000151";
    requireUserMock.mockResolvedValue({ id: "user-1" });
    getWritingProblemMock.mockResolvedValue({ id: problemId, kind: "q51" });
    getActiveDraftMock.mockResolvedValue(null);
    getSubmissionMock.mockResolvedValue(null);
    getRetrySubmissionSeedMock.mockResolvedValue({
      parent_submission_id: submissionId,
      answer_text: "answer",
      answer_json: null,
    });

    const element = await renderWritingQuestionPage(
      51,
      Promise.resolve({
        problem: problemId,
        retrySubmission: submissionId,
        returnTo: `/writing/feedback/short/${submissionId}?tab=sentences`,
      }),
    );
    render(element);

    expect(writingPageContentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        returnHref: `/writing/feedback/short/${submissionId}?tab=sentences`,
      }),
    );

    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({ id: "user-1" });
    getWritingProblemMock.mockResolvedValue({ id: problemId, kind: "q51" });
    getActiveDraftMock.mockResolvedValue(null);
    getRetrySubmissionSeedMock.mockResolvedValue({
      parent_submission_id: submissionId,
      answer_text: "answer",
      answer_json: null,
    });

    const mismatched = await renderWritingQuestionPage(
      51,
      Promise.resolve({
        problem: problemId,
        retrySubmission: submissionId,
        returnTo:
          "/writing/feedback/short/00000000-0000-4000-8000-000000000999",
      }),
    );
    render(mismatched);

    expect(writingPageContentMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ returnHref: "/practice/problems" }),
    );
  });

  it("accepts an owned feedback return target for the feedback next-problem flow", async () => {
    const problemId = "00000000-0000-4000-8000-000000000052";
    const submissionId = "00000000-0000-4000-8000-000000000152";
    requireUserMock.mockResolvedValue({ id: "user-1" });
    getWritingProblemMock.mockResolvedValue({ id: problemId, kind: "q52" });
    getActiveDraftMock.mockResolvedValue(null);
    getSubmissionMock.mockResolvedValue({
      id: submissionId,
      user_id: "user-1",
      question_no: 51,
    });

    const element = await renderWritingQuestionPage(
      52,
      Promise.resolve({
        problem: problemId,
        fresh: "1",
        returnTo: `/writing/feedback/short/${submissionId}`,
      }),
    );
    render(element);

    expect(getSubmissionMock).toHaveBeenCalledWith(submissionId);
    expect(writingPageContentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        returnHref: `/writing/feedback/short/${submissionId}`,
      }),
    );
  });

  it("rejects a feedback return target that is not owned by the current user", async () => {
    const problemId = "00000000-0000-4000-8000-000000000052";
    const submissionId = "00000000-0000-4000-8000-000000000152";
    requireUserMock.mockResolvedValue({ id: "user-1" });
    getWritingProblemMock.mockResolvedValue({ id: problemId, kind: "q52" });
    getActiveDraftMock.mockResolvedValue(null);
    getSubmissionMock.mockResolvedValue({
      id: submissionId,
      user_id: "user-2",
      question_no: 51,
    });

    const element = await renderWritingQuestionPage(
      52,
      Promise.resolve({
        problem: problemId,
        fresh: "1",
        returnTo: `/writing/feedback/short/${submissionId}`,
      }),
    );
    render(element);

    expect(writingPageContentMock).toHaveBeenCalledWith(
      expect.objectContaining({ returnHref: "/practice/problems" }),
    );
  });

  it("accepts only a comparison report for the current retry submission", async () => {
    const problemId = "00000000-0000-4000-8000-000000000053";
    const submissionId = "00000000-0000-4000-8000-000000000153";
    const reportId = "00000000-0000-4000-8000-000000000253";
    requireUserMock.mockResolvedValue({ id: "user-1" });
    getWritingProblemMock.mockResolvedValue({ id: problemId, kind: "q53" });
    getActiveDraftMock.mockResolvedValue(null);
    getRetrySubmissionSeedMock.mockResolvedValue({
      parent_submission_id: submissionId,
      answer_text: "answer",
      answer_json: null,
    });
    getComparisonReportMock.mockResolvedValue({
      id: reportId,
      current_submission_id: submissionId,
    });

    const element = await renderWritingQuestionPage(
      53,
      Promise.resolve({
        problem: problemId,
        retrySubmission: submissionId,
        returnTo: `/writing/reports/${reportId}/compare#scores`,
      }),
    );
    render(element);

    expect(getComparisonReportMock).toHaveBeenCalledWith(reportId);
    expect(writingPageContentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        returnHref: `/writing/reports/${reportId}/compare#scores`,
      }),
    );
  });
});
