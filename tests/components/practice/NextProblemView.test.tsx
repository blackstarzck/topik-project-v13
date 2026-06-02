// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "../../test-utils/renderWithIntl";
import { NextProblemView } from "../../../src/components/practice/NextProblemView";
import type {
  NextProblemBundle,
  NextProblemSuggestion,
} from "../../../src/lib/practice/next";

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

const emptySummary: NextProblemBundle["summary"] = {
  recentSubmissions: 0,
  averageScore: null,
  weakestDimensions: [],
};

function makeBundle(
  primary: NextProblemSuggestion | null,
  primaryTier: 1 | 2 | 3 | 4,
): NextProblemBundle {
  return {
    primary,
    primaryTier,
    summary: emptySummary,
    alternatives: [],
  };
}

const primary: NextProblemSuggestion = {
  problemId: "p-1",
  title: "다음 문제 제목",
  domain: "writing",
  questionNo: 53,
  source: "recommendation",
  reason: null,
};

describe("NextProblemView (Phase 7-D bundle signature)", () => {
  it("tier 4 shows Empty state + summary row", () => {
    renderWithIntl(<NextProblemView bundle={makeBundle(null, 4)} />);
    expect(screen.getByText("더 추천할 문제가 없습니다.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "문제 목록 보기" }));
    expect(pushMock).toHaveBeenCalledWith("/practice/problems");
  });

  it("tier 1 shows '추천' badge", () => {
    renderWithIntl(<NextProblemView bundle={makeBundle(primary, 1)} />);
    expect(screen.getByTestId("next-problem-badge").textContent).toBe("추천");
  });

  it("tier 2 shows '이어서' badge", () => {
    renderWithIntl(<NextProblemView bundle={makeBundle(primary, 2)} />);
    expect(screen.getByTestId("next-problem-badge").textContent).toBe("이어서");
  });

  it("tier 3 shows '탐색' badge", () => {
    renderWithIntl(<NextProblemView bundle={makeBundle(primary, 3)} />);
    expect(screen.getByTestId("next-problem-badge").textContent).toBe("탐색");
  });

  it("clicking card logs recommendation_clicked and pushes URL", () => {
    renderWithIntl(<NextProblemView bundle={makeBundle(primary, 1)} />);
    fireEvent.click(screen.getByTestId("next-problem-p-1"));
    expect(logStudyEventMock).toHaveBeenCalledWith({
      eventType: "recommendation_clicked",
      problemId: "p-1",
      payload: { source: "next" },
    });
    expect(pushMock).toHaveBeenCalledWith("/practice/problems/p-1");
  });
});
