// @vitest-environment jsdom
import { describe, expect, it, afterEach, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";

// These components call useRouter() and useSaveLearningGoal() (react-query). jsdom
// has neither an app-router context nor a QueryClientProvider, so mock both — the
// i18n chrome (verbatim ko strings) is what we assert here, mirroring how the
// dashboard test mocks next/navigation.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/learning/mutations", () => ({
  useSaveLearningGoal: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import { renderWithIntl } from "../../test-utils/renderWithIntl";
import { OnboardingSteps } from "../../../src/app/(workspace)/onboarding/learning-goal/OnboardingSteps";
import { OnboardingNavCta } from "../../../src/app/(workspace)/onboarding/learning-goal/OnboardingNavCta";
import { LearningGoalForm } from "../../../src/components/learning/LearningGoalForm";

// onboarding.* keys are merged into the committed ko catalog from staging.

afterEach(() => {
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

describe("OnboardingNavCta i18n chrome", () => {
  it("renders the previous and skip CTA labels", () => {
    renderWithIntl(<OnboardingNavCta userId="u1" />);
    expect(screen.getByText("이전 단계 수정")).toBeTruthy();
    expect(screen.getByText("건너뛰기")).toBeTruthy();
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
});
