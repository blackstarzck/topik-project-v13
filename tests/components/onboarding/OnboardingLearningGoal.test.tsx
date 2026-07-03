// @vitest-environment jsdom
import { describe, expect, it, afterEach, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";

const saveLearningGoalMock = vi.hoisted(() => vi.fn());

// These components call useRouter() and useSaveLearningGoal() (react-query). jsdom
// has neither an app-router context nor a QueryClientProvider, so mock both — the
// i18n chrome (verbatim ko strings) is what we assert here, mirroring how the
// dashboard test mocks next/navigation.
vi.mock("next/navigation", () => ({
  usePathname: () => "/onboarding/learning-goal",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/learning/mutations", () => ({
  useSaveLearningGoal: () => ({
    mutateAsync: saveLearningGoalMock,
    isPending: false,
  }),
}));
vi.mock("@/lib/auth/session", () => ({
  requireUser: vi.fn(async () => ({ id: "u1" })),
}));
vi.mock("@/lib/learning/server", () => ({
  getLearningGoal: vi.fn(async () => null),
}));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async (namespace: string) => {
    const pageMessages: Record<string, string> = {
      benefitFeedbackBody: "나만을 위한 첨삭",
      benefitFeedbackTitle: "AI 맞춤 피드백",
      benefitRecommendationBody: "내 목표에 맞는 문제",
      benefitRecommendationTitle: "맞춤 문제 추천",
      benefitReportBody: "실력 향상 추적",
      benefitReportTitle: "성장 리포트",
      benefitStripAria: "온보딩 혜택",
      brandSubtitle: "TOPIK Writing Tutor",
      heroBody:
        "목표와 언어를 선택하면, 나에게 맞는 문제와 피드백을 추천해드려요.",
      heroEyebrow: "ONBOARDING",
      heroTitle: "학습 목표 설정",
      mascotBody: "맞춤 문제와 피드백을 준비할게요.",
      mascotTitle: "목표와 언어를 알려주시면",
      metaTitle: "학습 목표 설정",
    };

    return (key: string) =>
      namespace === "onboarding.page" ? pageMessages[key] : key;
  }),
}));

import { renderWithIntl } from "../../test-utils/renderWithIntl";
import OnboardingLearningGoalPage from "../../../src/app/(workspace)/onboarding/learning-goal/page";
import { OnboardingSteps } from "../../../src/app/(workspace)/onboarding/learning-goal/OnboardingSteps";
import { OnboardingNavCta } from "../../../src/app/(workspace)/onboarding/learning-goal/OnboardingNavCta";
import { LearningGoalForm } from "../../../src/components/learning/LearningGoalForm";

// onboarding.* keys are merged into the committed ko catalog from staging.

afterEach(() => {
  saveLearningGoalMock.mockReset();
  cleanup();
});

describe("OnboardingSteps i18n chrome", () => {
  it("renders the ICU step counter and the three step labels", () => {
    renderWithIntl(<OnboardingSteps />);
    // counter ICU "{current}/{total} 단계" with the default last step (3/3).
    expect(screen.getByText("3/3 단계")).toBeTruthy();
    expect(screen.getByText("계정 생성")).toBeTruthy();
    expect(screen.getByText("이메일 인증")).toBeTruthy();
    expect(screen.getByText("학습 목표")).toBeTruthy();
  });
});

describe("OnboardingLearningGoalPage chrome", () => {
  it("omits the promotional card and stepper around the learning goal form", async () => {
    renderWithIntl(await OnboardingLearningGoalPage());

    expect(screen.queryByText("Talkpik AI")).toBeNull();
    expect(screen.queryByText("목표와 언어를 알려주시면")).toBeNull();
    expect(screen.queryByText("맞춤 문제와 피드백을 준비할게요.")).toBeNull();
    expect(screen.queryByText("맞춤 문제 추천")).toBeNull();
    expect(screen.queryByText("AI 맞춤 피드백")).toBeNull();
    expect(screen.queryByText("성장 리포트")).toBeNull();
    expect(screen.queryByText("3/3 단계")).toBeNull();
    expect(screen.queryByText("계정 생성")).toBeNull();
    expect(screen.queryByText("이메일 인증")).toBeNull();
    expect(screen.queryByText("이전 단계 수정")).toBeNull();
  });

  it("keeps the save CTA primary and places the text-only skip CTA after it", async () => {
    const { container } = renderWithIntl(await OnboardingLearningGoalPage());

    const goalShell = container.querySelector(".onboarding-goal-shell");
    const actionFlow = container.querySelector(".onboarding-goal-cta-flow");
    const submitButton = actionFlow?.querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    );
    const skipButton = actionFlow?.querySelector<HTMLButtonElement>(
      "button.ant-btn-text",
    );

    expect(goalShell?.className).toContain("gap-12");
    expect(actionFlow).toBeTruthy();
    expect(submitButton?.textContent).toContain("저장하고 대시보드로 이동");
    expect(skipButton?.textContent).toContain("건너뛰기");
    expect(
      submitButton!.compareDocumentPosition(skipButton!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(skipButton!.closest(".onboarding-goal-cta-flow")).toBe(actionFlow);
    expect(actionFlow?.className).toContain("gap-1");
    expect(submitButton?.className).toContain("ant-btn-primary");
    expect(submitButton?.className).toContain("ant-btn-block");
    expect(skipButton?.className).toContain("onboarding-skip-cta");
    expect(skipButton?.className).toContain("ant-btn-text");
    expect(skipButton?.className).toContain("ant-btn-block");
  });
});

describe("OnboardingNavCta i18n chrome", () => {
  it("renders only the skip CTA as a full-width text button", () => {
    renderWithIntl(<OnboardingNavCta userId="u1" />);
    expect(screen.queryByText("이전 단계 수정")).toBeNull();
    const skipButton = screen.getByRole("button", { name: "건너뛰기" });
    expect(skipButton.className).toContain("onboarding-skip-cta");
    expect(skipButton.className).toContain("ant-btn-text");
    expect(skipButton.className).toContain("ant-btn-block");
  });
});

describe("LearningGoalForm i18n chrome", () => {
  it("renders the heading, field labels, and submit CTA", () => {
    renderWithIntl(<LearningGoalForm userId="u1" />);
    expect(screen.getByText("학습 목표 설정")).toBeTruthy();
    expect(
      screen.getByText("목표 설정은 맞춤 추천의 기반이 됩니다."),
    ).toBeTruthy();
    expect(screen.getByText("TOPIK 등급")).toBeTruthy();
    expect(screen.getByText("목표 등급")).toBeTruthy();
    expect(screen.getByText("시험 일정 (선택)")).toBeTruthy();
    expect(screen.getByText("주당 학습 시간 (분, 선택)")).toBeTruthy();
    expect(screen.getByText("취약 영역 (선택)")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "저장하고 대시보드로 이동" }),
    ).toBeTruthy();
  });

  it("renders the default TOPIK II option label", () => {
    renderWithIntl(<LearningGoalForm userId="u1" />);
    // Default topik_level is TOPIK_II — its option label is rendered in the Select.
    expect(screen.getByText("TOPIK II (3-6급)")).toBeTruthy();
  });

  it("keeps enough vertical room above the save CTA", () => {
    const { container } = renderWithIntl(<LearningGoalForm userId="u1" />);
    const submitButton = container.querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    );

    expect(submitButton).toBeTruthy();
    expect(submitButton?.closest(".ant-form-item")?.className).toContain(
      "pt-10",
    );
  });

  it("omits the decorative field icons from each goal row", () => {
    const { container } = renderWithIntl(<LearningGoalForm userId="u1" />);

    expect(
      container.querySelectorAll('[aria-hidden="true"].h-11.w-11'),
    ).toHaveLength(0);
  });

  it("uses borderless field rows with 16px titles and 14px descriptions", () => {
    const { container } = renderWithIntl(<LearningGoalForm userId="u1" />);

    const topikTitle = screen.getByText("TOPIK 등급");
    const topikDescription = screen.getByText(
      "이번 시험에서 준비할 TOPIK 범위를 선택해주세요.",
    );

    expect(container.querySelectorAll(".app-card")).toHaveLength(0);
    expect(topikTitle.closest(".app-card")).toBeNull();
    expect(topikTitle.className).toContain("text-base");
    expect(topikDescription.className).toContain("text-sm");
  });

  it("renders weak areas as a multi-check button grid", () => {
    const { container } = renderWithIntl(<LearningGoalForm userId="u1" />);
    const weakAreaGroup = container.querySelector<HTMLElement>(
      '[data-testid="weak-area-options"]',
    );

    expect(weakAreaGroup).toBeTruthy();
    expect(weakAreaGroup?.className).toContain("grid");
    expect(container.querySelector(".ant-select-multiple")).toBeNull();

    const vocabulary = weakAreaGroup?.querySelector<HTMLButtonElement>(
      '[data-value="vocabulary"]',
    );
    const grammar = weakAreaGroup?.querySelector<HTMLButtonElement>(
      '[data-value="grammar"]',
    );

    expect(vocabulary).toBeTruthy();
    expect(grammar).toBeTruthy();
    expect(vocabulary?.className).toContain("weak-area-choice");
    expect(vocabulary?.className).toContain("ant-btn-variant-outlined");
    expect(vocabulary?.className).not.toContain("weak-area-choice--selected");
    expect(vocabulary?.className).not.toContain("ant-btn-variant-solid");
    expect(vocabulary?.getAttribute("aria-pressed")).toBe("false");
    expect(grammar?.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(vocabulary!);
    fireEvent.click(grammar!);

    expect(vocabulary?.className).toContain("weak-area-choice--selected");
    expect(grammar?.className).toContain("weak-area-choice--selected");
    expect(vocabulary?.className).toContain("ant-btn-variant-outlined");
    expect(grammar?.className).toContain("ant-btn-variant-outlined");
    expect(vocabulary?.className).not.toContain("ant-btn-variant-solid");
    expect(grammar?.className).not.toContain("ant-btn-variant-solid");
    expect(vocabulary?.getAttribute("aria-pressed")).toBe("true");
    expect(grammar?.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(vocabulary!);

    expect(vocabulary?.getAttribute("aria-pressed")).toBe("false");
    expect(grammar?.getAttribute("aria-pressed")).toBe("true");
  });

  it("submits checked weak area button values as weak_areas", async () => {
    saveLearningGoalMock.mockResolvedValueOnce({});
    const { container } = renderWithIntl(<LearningGoalForm userId="u1" />);
    const weakAreaGroup = container.querySelector<HTMLElement>(
      '[data-testid="weak-area-options"]',
    );

    expect(weakAreaGroup).toBeTruthy();

    fireEvent.click(
      weakAreaGroup!.querySelector<HTMLButtonElement>(
        '[data-value="vocabulary"]',
      )!,
    );
    fireEvent.click(
      weakAreaGroup!.querySelector<HTMLButtonElement>(
        '[data-value="grammar"]',
      )!,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "저장하고 대시보드로 이동" }),
    );

    await waitFor(() => {
      expect(saveLearningGoalMock).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "u1",
          weak_areas: ["vocabulary", "grammar"],
          is_active: true,
        }),
      );
    });
  });
});
