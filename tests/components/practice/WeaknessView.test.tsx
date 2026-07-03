// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "../../test-utils/renderWithIntl";
import { WeaknessView } from "../../../src/components/practice/WeaknessView";

const pushMock = vi.fn();
const logStudyEventMock = vi.fn();
const consumeRecommendationItemMock = vi.fn();

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

vi.mock("@/lib/practice/consume", () => ({
  consumeRecommendationItem: (...args: unknown[]) => {
    consumeRecommendationItemMock(...args);
    return Promise.resolve();
  },
}));

beforeEach(() => {
  pushMock.mockReset();
  logStudyEventMock.mockReset();
  consumeRecommendationItemMock.mockReset();
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
    renderWithIntl(<WeaknessView weakDimensions={[]} recommendations={[]} />);

    expect(
      screen.getByText("글쓰기를 5건 이상 제출하면 약점 분석이 활성화됩니다."),
    ).toBeTruthy();
    expect(screen.getByText("추천 문제가 아직 없습니다.")).toBeTruthy();
    const cta = screen.getAllByRole("button", { name: "문제 목록 보기" })[0];
    fireEvent.click(cta);
    expect(pushMock).toHaveBeenCalledWith("/practice/problems");
  });

  it("renders weak dimensions and recommendation cards", () => {
    renderWithIntl(
      <WeaknessView
        weakDimensions={[
          { dimension: "grammar", averageScore: 40 },
          { dimension: "vocab", averageScore: 55 },
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

  it("logs recommendation_clicked and pushes the problem URL from the representative CTA", () => {
    renderWithIntl(
      <WeaknessView
        weakDimensions={[{ dimension: "grammar", averageScore: 30 }]}
        recommendations={[
          { problem_id: "prob-42", title: "추천 문제", question_no: 52 },
        ]}
      />,
    );

    const card = screen.getByTestId("weakness-rec-prob-42");
    fireEvent.click(card);
    expect(logStudyEventMock).not.toHaveBeenCalled();

    const start = screen.getByTestId("weakness-primary-start");
    fireEvent.click(start);
    expect(logStudyEventMock).toHaveBeenCalledTimes(1);
    expect(logStudyEventMock).toHaveBeenCalledWith({
      eventType: "recommendation_clicked",
      problemId: "prob-42",
      payload: { source: "weakness" },
    });
    expect(consumeRecommendationItemMock).toHaveBeenCalledWith(null);
    expect(pushMock).toHaveBeenCalledWith(
      "/writing/answer-writing-52?problem=prob-42",
    );
  });

  it("selects a recommendation card with keyboard without starting navigation", () => {
    renderWithIntl(
      <WeaknessView
        weakDimensions={[{ dimension: "grammar", averageScore: 30 }]}
        recommendations={[
          { problem_id: "prob-1", title: "First", question_no: 51 },
          { problem_id: "prob-2", title: "Second", question_no: 52 },
        ]}
      />,
    );

    const firstCard = screen.getByTestId("weakness-rec-prob-1");
    const secondCard = screen.getByTestId("weakness-rec-prob-2");
    expect(firstCard.getAttribute("aria-pressed")).toBe("true");
    expect(secondCard.getAttribute("aria-pressed")).toBe("false");

    fireEvent.keyDown(secondCard, { key: "Enter" });

    expect(firstCard.getAttribute("aria-pressed")).toBe("false");
    expect(secondCard.getAttribute("aria-pressed")).toBe("true");
    expect(logStudyEventMock).not.toHaveBeenCalled();
    expect(consumeRecommendationItemMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("guards the selected recommendation start action against duplicate clicks", () => {
    renderWithIntl(
      <WeaknessView
        weakDimensions={[{ dimension: "grammar", averageScore: 30 }]}
        recommendations={[
          {
            problem_id: "prob-guard",
            title: "Guarded",
            question_no: 51,
            item_id: "item-guard",
          },
        ]}
      />,
    );

    const start = screen.getByTestId("weakness-primary-start");
    fireEvent.click(start);
    fireEvent.click(start);

    expect(logStudyEventMock).toHaveBeenCalledTimes(1);
    expect(consumeRecommendationItemMock).toHaveBeenCalledTimes(1);
    expect(consumeRecommendationItemMock).toHaveBeenCalledWith("item-guard");
    expect(pushMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces cautious weakness insights, recommendation reasons, and one primary start action", () => {
    renderWithIntl(
      <WeaknessView
        weakDimensions={[
          { dimension: "grammar", averageScore: 36 },
          { dimension: "vocab", averageScore: 62 },
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
    expect(screen.getByText("다음 학습")).toBeTruthy();
    expect(screen.getAllByText("선택됨").length).toBeGreaterThan(0);
    expect(screen.queryByText(/결제/)).toBeNull();
    expect(screen.queryByText(/유료/)).toBeNull();

    const startButton = screen.getByTestId("weakness-primary-start");
    expect(startButton.className).toContain("ant-btn-primary");
    fireEvent.click(startButton);
    expect(logStudyEventMock).toHaveBeenCalledWith({
      eventType: "recommendation_clicked",
      problemId: "prob-88",
      payload: { source: "weakness" },
    });
    expect(pushMock).toHaveBeenCalledWith("/practice/problems");
  });

  it("shows a fallback reason when a tag-based recommendation has no stored reason", () => {
    renderWithIntl(
      <WeaknessView
        weakDimensions={[{ dimension: "grammar", averageScore: 36 }]}
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
    renderWithIntl(
      <WeaknessView
        weakDimensions={[{ dimension: "grammar", averageScore: 36 }]}
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
    expect(reason.className).toContain("whitespace-nowrap");
    expect(reason.className).toContain("text-ellipsis");
    expect(reason.className).toContain("overflow-hidden");
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
      renderWithIntl(
        <WeaknessView
          weakDimensions={[{ dimension, averageScore: 30 }]}
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
    renderWithIntl(
      <WeaknessView
        weakDimensions={[{ dimension: "grammar", averageScore: 30 }]}
        recommendations={Array.from({ length: 5 }, (_, i) => ({
          problem_id: `prob-${i + 1}`,
          title: `추천 문제 ${i + 1}`,
          question_no: i + 1,
          reason: null,
          source: "recommendation" as const,
        }))}
      />,
    );

    expect(
      screen.getByTestId("weakness-rec-prob-1").getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen.getByTestId("weakness-rec-prob-4").getAttribute("aria-pressed"),
    ).toBe("false");
    expect(screen.queryByTestId("weakness-rec-prob-5")).toBeNull();
    expect(screen.getByRole("button", { name: "선택됨" })).toBeTruthy();
    expect(
      screen.getAllByRole("button", { name: "이 문제 선택" }),
    ).toHaveLength(3);
    expect(
      screen.getByRole("button", { name: /추천 1번 문제 풀기/ }),
    ).toBeTruthy();
  });
});
