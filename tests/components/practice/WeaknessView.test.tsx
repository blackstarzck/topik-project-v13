// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { WeaknessView } from "../../../src/components/practice/WeaknessView";

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
  // antd Modal/Tooltip stub for jsdom — matchMedia is not implemented.
  // Phase 7-D Task 7: DimensionTabs uses Ant Design Tabs → ResizeObserver.
  if (!(globalThis as Record<string, unknown>).ResizeObserver) {
    (globalThis as Record<string, unknown>).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
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

describe("WeaknessView", () => {
  it("renders the empty-state CTA when weakDimensions is empty", () => {
    render(<WeaknessView weakDimensions={[]} recommendations={[]} />);

    expect(
      screen.getByText("글쓰기를 5건 이상 제출하면 약점 분석이 활성화됩니다."),
    ).toBeTruthy();
    const cta = screen.getByRole("button", { name: "문제 풀기" });
    fireEvent.click(cta);
    expect(pushMock).toHaveBeenCalledWith("/practice/problems");
  });

  it("renders weak dimensions and recommendation cards", () => {
    render(
      <WeaknessView
        weakDimensions={[
          { dimension: "grammar", averageScore: 0.4 },
          { dimension: "vocab", averageScore: 0.55 },
        ]}
        recommendations={[
          { problem_id: "p-1", title: "어휘 연습 문제", question_no: 51 },
        ]}
      />,
    );

    // Phase 7-D Task 7: "문법" / "어휘" appear in DiagnosticCard +
    // DimensionTabs labels, so use getAllByText.
    expect(screen.getAllByText(/문법/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/어휘/).length).toBeGreaterThan(0);
    expect(screen.getByText("어휘 연습 문제")).toBeTruthy();
  });

  it("logs recommendation_clicked and pushes the problem URL on rec card click", () => {
    render(
      <WeaknessView
        weakDimensions={[{ dimension: "grammar", averageScore: 0.3 }]}
        recommendations={[
          { problem_id: "prob-42", title: "추천 문제", question_no: 52 },
        ]}
      />,
    );

    const card = screen.getByTestId("weakness-rec-prob-42");
    fireEvent.click(card);

    expect(logStudyEventMock).toHaveBeenCalledTimes(1);
    expect(logStudyEventMock).toHaveBeenCalledWith({
      eventType: "recommendation_clicked",
      problemId: "prob-42",
      payload: { source: "weakness" },
    });
    expect(pushMock).toHaveBeenCalledWith("/practice/problems/prob-42");
  });
});
