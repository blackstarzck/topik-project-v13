// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextProblemView } from "../../../src/components/practice/NextProblemView";

const pushMock = vi.fn();
const logStudyEventMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("@/lib/events/study-events", () => ({
  logStudyEvent: (...args: unknown[]) => {
    logStudyEventMock(...args);
    return Promise.resolve();
  },
}));

beforeEach(() => {
  pushMock.mockReset();
  logStudyEventMock.mockReset();
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
  }
});

afterEach(() => {
  cleanup();
});

const problem = { id: "p-1", title: "다음 문제 제목", question_no: 53 };

describe("NextProblemView", () => {
  it("tier 4 shows Empty state with link back to problems", () => {
    render(<NextProblemView problem={null} tier={4} />);
    expect(screen.getByText("더 추천할 문제가 없습니다.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "문제 목록 보기" }));
    expect(pushMock).toHaveBeenCalledWith("/practice/problems");
  });

  it("tier 1 shows '추천' badge and recommendation copy", () => {
    render(<NextProblemView problem={problem} tier={1} />);
    expect(screen.getByTestId("next-problem-badge").textContent).toBe("추천");
    expect(screen.getByText("선생님이 추천한 문제예요.")).toBeTruthy();
  });

  it("tier 2 shows '이어서' badge and same-question copy", () => {
    render(<NextProblemView problem={problem} tier={2} />);
    expect(screen.getByTestId("next-problem-badge").textContent).toBe("이어서");
    expect(
      screen.getByText("방금 푼 문항과 같은 유형으로 계속 풀어볼까요?"),
    ).toBeTruthy();
  });

  it("tier 3 shows '탐색' badge and exploration copy", () => {
    render(<NextProblemView problem={problem} tier={3} />);
    expect(screen.getByTestId("next-problem-badge").textContent).toBe("탐색");
    expect(screen.getByText("오늘 처음 만나는 문제예요.")).toBeTruthy();
  });

  it("clicking the card logs recommendation_clicked with source='next' and pushes URL", () => {
    render(<NextProblemView problem={problem} tier={1} />);
    fireEvent.click(screen.getByTestId("next-problem-p-1"));
    expect(logStudyEventMock).toHaveBeenCalledWith({
      eventType: "recommendation_clicked",
      problemId: "p-1",
      payload: { source: "next" },
    });
    expect(pushMock).toHaveBeenCalledWith("/practice/problems/p-1");
  });
});
