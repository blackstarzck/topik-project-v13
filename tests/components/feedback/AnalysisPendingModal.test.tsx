// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AnalysisPendingModal } from "../../../src/components/feedback/AnalysisPendingModal";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

function makeHandlers() {
  return {
    onGoDashboard: vi.fn(),
    onGoLibrary: vi.fn(),
    onAutoRedirect: vi.fn(),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("AnalysisPendingModal", () => {
  it("shows the wait copy and counts the library button down 5..1", () => {
    const handlers = makeHandlers();
    renderWithIntl(<AnalysisPendingModal open {...handlers} />);

    expect(screen.getByTestId("analysis-pending-modal")).toBeTruthy();
    expect(screen.getByText("곧 분석이 완료될 거예요")).toBeTruthy();
    expect(
      screen.getByText("다른 문제를 풀면서 조금만 기다려주세요!"),
    ).toBeTruthy();
    // 자동 이동 예고는 초기값(5초)으로 고정해 1회만 읽히게 한다.
    expect(
      screen.getByTestId("analysis-pending-auto-note").textContent,
    ).toContain("5초");

    const libraryButton = screen.getByTestId("analysis-pending-library");
    expect(libraryButton.textContent).toContain("내 서재로 이동 (5)");

    for (const expected of [4, 3, 2, 1]) {
      act(() => {
        vi.advanceTimersByTime(1_000);
      });
      expect(libraryButton.textContent).toContain(
        `내 서재로 이동 (${expected})`,
      );
    }
  });

  it("fires the auto redirect exactly once after the countdown expires", () => {
    const handlers = makeHandlers();
    renderWithIntl(<AnalysisPendingModal open {...handlers} />);

    act(() => {
      vi.advanceTimersByTime(4_999);
    });
    expect(handlers.onAutoRedirect).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1_001);
    });
    expect(handlers.onAutoRedirect).toHaveBeenCalledTimes(1);
    expect(handlers.onGoLibrary).not.toHaveBeenCalled();
    expect(handlers.onGoDashboard).not.toHaveBeenCalled();

    // 만료 후 시간이 더 흘러도 다시 발화하지 않는다.
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(handlers.onAutoRedirect).toHaveBeenCalledTimes(1);
  });

  it("suppresses the auto redirect once a footer button was clicked", () => {
    const handlers = makeHandlers();
    renderWithIntl(<AnalysisPendingModal open {...handlers} />);

    fireEvent.click(screen.getByTestId("analysis-pending-library"));
    expect(handlers.onGoLibrary).toHaveBeenCalledTimes(1);

    // 이미 이동했으므로 자동 이동과 중복 클릭 모두 무시된다.
    fireEvent.click(screen.getByTestId("analysis-pending-dashboard"));
    act(() => {
      vi.advanceTimersByTime(6_000);
    });

    expect(handlers.onGoLibrary).toHaveBeenCalledTimes(1);
    expect(handlers.onGoDashboard).not.toHaveBeenCalled();
    expect(handlers.onAutoRedirect).not.toHaveBeenCalled();
  });

  it("routes to the dashboard from the footer button", () => {
    const handlers = makeHandlers();
    renderWithIntl(<AnalysisPendingModal open {...handlers} />);

    fireEvent.click(screen.getByTestId("analysis-pending-dashboard"));

    expect(handlers.onGoDashboard).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(6_000);
    });
    expect(handlers.onAutoRedirect).not.toHaveBeenCalled();
  });

  it("cleans timers up on unmount so the auto redirect never fires afterwards", () => {
    const handlers = makeHandlers();
    const { unmount } = renderWithIntl(
      <AnalysisPendingModal open {...handlers} />,
    );

    unmount();
    act(() => {
      vi.advanceTimersByTime(6_000);
    });

    expect(handlers.onAutoRedirect).not.toHaveBeenCalled();
  });
});
