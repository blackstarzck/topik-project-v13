// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

const PANEL_STATE = {
  submissionId: "submission-exhausted",
  questionNo: 51 as const,
  answerText: "stored answer text",
  charCount: 18,
  submittedAt: "2026-06-25T07:04:11.000Z",
  feedbackHref: "/writing/feedback/short/submission-exhausted",
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  routerMocks.back.mockReset();
  routerMocks.refresh.mockReset();
  routerMocks.replace.mockReset();
  routerMocks.prefetch.mockReset();
  routerMocks.push.mockReset();
});

describe("SubmittedAnalysisPanel exhausted polling state", () => {
  it("opens the wait modal instead of the inline alert and does not redirect immediately", () => {
    const pushStateSpy = vi.spyOn(window.history, "pushState");

    renderWithIntl(<SubmittedAnalysisPanel state={PANEL_STATE} />);

    expect(screen.getByTestId("analysis-pending-modal")).toBeTruthy();
    expect(screen.getByTestId("analysis-pending-auto-note")).toBeTruthy();
    expect(screen.queryByTestId("analysis-polling-exhausted")).toBeNull();
    expect(routerMocks.replace).not.toHaveBeenCalled();
    expect(routerMocks.push).not.toHaveBeenCalled();
    // 소진 상태에서는 뒤로가기 가드(sentinel pushState)를 걸지 않는다.
    expect(pushStateSpy).not.toHaveBeenCalled();
  });

  it("routes to the library when the countdown button is clicked and skips the auto redirect", () => {
    renderWithIntl(<SubmittedAnalysisPanel state={PANEL_STATE} />);

    fireEvent.click(screen.getByTestId("analysis-pending-library"));

    expect(routerMocks.push).toHaveBeenCalledTimes(1);
    expect(routerMocks.push).toHaveBeenCalledWith("/library");

    act(() => {
      vi.advanceTimersByTime(6_000);
    });

    expect(routerMocks.replace).not.toHaveBeenCalled();
  });

  it("routes to the dashboard when the dashboard button is clicked", () => {
    renderWithIntl(<SubmittedAnalysisPanel state={PANEL_STATE} />);

    fireEvent.click(screen.getByTestId("analysis-pending-dashboard"));

    expect(routerMocks.push).toHaveBeenCalledTimes(1);
    expect(routerMocks.push).toHaveBeenCalledWith("/dashboard");

    act(() => {
      vi.advanceTimersByTime(6_000);
    });

    expect(routerMocks.replace).not.toHaveBeenCalled();
  });

  it("automatically replaces to the library after the 5 second countdown", () => {
    renderWithIntl(<SubmittedAnalysisPanel state={PANEL_STATE} />);

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(routerMocks.replace).toHaveBeenCalledTimes(1);
    expect(routerMocks.replace).toHaveBeenCalledWith("/library");
    expect(routerMocks.push).not.toHaveBeenCalled();
  });
});
