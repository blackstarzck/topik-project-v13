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
  // Ant Design Tabs uses ResizeObserver and matchMedia, which jsdom does not provide.
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

  it("surfaces cautious weakness insights, recommendation reasons, primary start action, and deferred paywall entry", () => {
    render(
      <WeaknessView
        weakDimensions={[
          { dimension: "grammar", averageScore: 0.36 },
          { dimension: "vocab", averageScore: 0.62 },
        ]}
        recommendations={[
          {
            problem_id: "prob-88",
            title: "시제와 연결어 복습",
            question_no: 88,
            reason: "최근 답안에서 시제 연결이 자주 흔들렸어요.",
            source: "recommendation",
          },
        ]}
      />,
    );

    expect(screen.getByText("약점 인사이트")).toBeTruthy();
    expect(screen.getByText("왜 이 영역을 먼저 보나요?")).toBeTruthy();
    expect(screen.getByText("자주 보이는 예")).toBeTruthy();
    expect(screen.getByText("연습 전략")).toBeTruthy();
    expect(
      screen.getByText(/최근 답안에서 보이는 경향을 바탕으로 추정한 안내예요/),
    ).toBeTruthy();

    expect(
      screen.getByText("최근 답안에서 시제 연결이 자주 흔들렸어요."),
    ).toBeTruthy();
    expect(screen.getByText("추천 근거")).toBeTruthy();

    const startButton = screen.getByRole("button", { name: /추천 학습 시작/ });
    expect(startButton.className).toContain("ant-btn-primary");
    fireEvent.click(startButton);
    expect(logStudyEventMock).toHaveBeenCalledWith({
      eventType: "recommendation_clicked",
      problemId: "prob-88",
      payload: { source: "weakness" },
    });
    expect(pushMock).toHaveBeenCalledWith("/practice/problems/prob-88");

    expect(screen.getByText("더 깊은 추천 보기")).toBeTruthy();
    expect(
      screen.getByText(
        /결제 기능은 아직 준비 중이라 실제 결제나 구독은 진행되지 않아요/,
      ),
    ).toBeTruthy();
  });

  it("shows a fallback reason when a tag-based recommendation has no stored reason", () => {
    render(
      <WeaknessView
        weakDimensions={[{ dimension: "grammar", averageScore: 0.36 }]}
        recommendations={[
          {
            problem_id: "prob-99",
            title: "문법 태그 복습",
            question_no: 99,
            reason: null,
            source: "tag_fallback",
          },
        ]}
      />,
    );

    expect(screen.getByText("약점 태그 기반")).toBeTruthy();
    expect(
      screen.getByText("문법 영역과 관련된 문항이라 우선 추천합니다."),
    ).toBeTruthy();
  });

  it("keeps recommendation card title and reason within IA display limits", () => {
    render(
      <WeaknessView
        weakDimensions={[{ dimension: "grammar", averageScore: 0.36 }]}
        recommendations={[
          {
            problem_id: "prob-100",
            title: "12345678901234567890123456789",
            question_no: 100,
            reason: "긴 추천 이유도 카드 안에서는 한 줄로만 표시합니다.",
            source: "recommendation",
          },
        ]}
      />,
    );

    expect(screen.getByText("1234567890123456789012345678...")).toBeTruthy();
    expect(screen.queryByText("12345678901234567890123456789")).toBeNull();

    const reason = screen.getByText(
      "긴 추천 이유도 카드 안에서는 한 줄로만 표시합니다.",
    ) as HTMLElement;
    expect(reason.style.whiteSpace).toBe("nowrap");
    expect(reason.style.textOverflow).toBe("ellipsis");
    expect(reason.style.overflow).toBe("hidden");
  });

  // Regression: the data layer (src/lib/practice/weakness.ts WEAKNESS_DIMENSIONS)
  // emits `content`, `expression`, and `topic_fit`. The view's dimension-label
  // map must cover all of them, or the raw English key leaks into the insight
  // Alert and the tag-fallback reason (inconsistent with DiagnosticCard /
  // DimensionTabs which render the Korean label for the same dimension).
  it.each([
    ["topic_fit", "주제 적합성"],
    ["content", "내용"],
    ["expression", "표현"],
  ])(
    "renders the Korean dimension label for a %s leading weakness instead of the raw key",
    (dimension, label) => {
      render(
        <WeaknessView
          weakDimensions={[{ dimension, averageScore: 0.3 }]}
          recommendations={[
            {
              problem_id: "prob-dim",
              title: "차원 라벨 확인 문제",
              question_no: 1,
              reason: null,
              source: "tag_fallback",
            },
          ]}
        />,
      );

      // Insight Alert headline must use the Korean label, never the raw key.
      expect(
        screen.getByText(`${label} 영역을 먼저 볼 수 있어요.`),
      ).toBeTruthy();
      // tag_fallback reason must also use the Korean label.
      expect(
        screen.getByText(`${label} 영역과 관련된 문항이라 우선 추천합니다.`),
      ).toBeTruthy();
      // The raw English dimension key must never reach the user.
      expect(screen.queryAllByText(new RegExp(dimension)).length).toBe(0);
    },
  );

  // IA X-07 §5: "카드 4개 이하". Defensive cap so an over-long upstream list
  // never blows past the spec, independent of server-side limiting.
  it("caps recommendation cards at the IA limit of 4", () => {
    render(
      <WeaknessView
        weakDimensions={[{ dimension: "grammar", averageScore: 0.3 }]}
        recommendations={Array.from({ length: 5 }, (_, i) => ({
          problem_id: `prob-${i + 1}`,
          title: `추천 문제 ${i + 1}`,
          question_no: i + 1,
          reason: null,
          source: "recommendation" as const,
        }))}
      />,
    );

    expect(screen.getByTestId("weakness-rec-prob-4")).toBeTruthy();
    expect(screen.queryByTestId("weakness-rec-prob-5")).toBeNull();
    expect(
      screen.getAllByRole("button", { name: /추천 학습 시작/ }),
    ).toHaveLength(4);
  });
});
