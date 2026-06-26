// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SubmittedAnalysisPanel } from "../../../src/components/writing/SubmittedAnalysisPanel";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

const routerMocks = vi.hoisted(() => ({
  back: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

vi.mock("@/lib/writing/queries", () => ({
  useFeedbackStatus: () => ({
    data: "analyzing",
    pollingExhausted: true,
  }),
}));

afterEach(() => {
  cleanup();
  routerMocks.back.mockReset();
  routerMocks.refresh.mockReset();
  routerMocks.replace.mockReset();
  routerMocks.prefetch.mockReset();
  routerMocks.push.mockReset();
});

describe("SubmittedAnalysisPanel exhausted polling state", () => {
  it("shows the library handoff instead of leaving the learner in an endless analysis state", async () => {
    renderWithIntl(
      <SubmittedAnalysisPanel
        state={{
          submissionId: "submission-exhausted",
          questionNo: 51,
          answerText: "stored answer text",
          charCount: 18,
          submittedAt: "2026-06-25T07:04:11.000Z",
          feedbackHref: "/writing/feedback/short/submission-exhausted",
        }}
      />,
    );

    expect(
      await screen.findByTestId("analysis-polling-exhausted"),
    ).toBeTruthy();

    fireEvent.click(screen.getByTestId("analysis-library-status-link"));

    expect(routerMocks.push).toHaveBeenCalledWith("/library");
    expect(screen.queryByTestId("analysis-loading-background")).toBeNull();
  });
});
