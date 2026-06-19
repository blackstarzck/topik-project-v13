// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";

import { Hero } from "../../../src/components/landing/Hero";
import { LandingHeader } from "../../../src/components/landing/LandingHeader";
import { PortfolioLandingLayout } from "../../../src/components/landing/PortfolioLandingLayout";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

const pushMock = vi.fn();

vi.mock("gsap", () => ({
  gsap: {
    context: (callback: () => void) => {
      callback();
      return { revert: vi.fn() };
    },
    from: vi.fn(),
    registerPlugin: vi.fn(),
    set: vi.fn(),
    timeline: vi.fn(() => {
      const timeline = {
        from: vi.fn(() => timeline),
      };
      return timeline;
    }),
    to: vi.fn(),
    utils: {
      toArray: vi.fn(() => []),
    },
  },
}));

vi.mock("gsap/ScrollTrigger", () => ({
  ScrollTrigger: {
    create: vi.fn(),
    refresh: vi.fn(),
  },
}));

vi.mock("swiper/modules", () => ({
  Autoplay: {},
  FreeMode: {},
}));

vi.mock("swiper/react", () => ({
  Swiper: ({ children }: { children: ReactNode }) => (
    <div data-testid="mock-swiper">{children}</div>
  ),
  SwiperSlide: ({ children }: { children: ReactNode }) => (
    <div data-testid="mock-swiper-slide">{children}</div>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

afterEach(() => {
  cleanup();
  pushMock.mockReset();
});

describe("landing auth CTA", () => {
  it("keeps only the anonymous login CTA in the global nav", () => {
    renderWithIntl(<LandingHeader authStatus="anonymous" />);

    expect(screen.getByRole("link", { name: "로그인" }).getAttribute("href")).toBe(
      "/login",
    );
    expect(screen.queryByRole("link", { name: "무료 시작" })).toBeNull();
    expect(screen.getByRole("link", { name: "기능" }).getAttribute("href")).toBe(
      "#features",
    );
  });

  it("keeps anonymous hero focused on free start without a login CTA", () => {
    renderWithIntl(<Hero authStatus="anonymous" />);

    fireEvent.click(screen.getByRole("button", { name: "무료 시작" }));

    expect(screen.queryByRole("button", { name: "로그인" })).toBeNull();
    expect(pushMock).toHaveBeenCalledWith("/sign-up");
  });

  it("routes pending-consent users back into post-auth instead of dashboard", () => {
    renderWithIntl(<LandingHeader authStatus="pending-consent" />);

    const continueLink = screen.getByRole("link", {
      name: "약관 동의하고 계속하기",
    });
    expect(continueLink.getAttribute("href")).toBe(
      "/auth/post-auth?intent=login",
    );
    expect(screen.queryByText("대시보드")).toBeNull();
  });

  it("uses the pending-consent CTA in the hero", () => {
    renderWithIntl(<Hero authStatus="pending-consent" />);

    fireEvent.click(
      screen.getByRole("button", { name: "약관 동의하고 계속하기" }),
    );

    expect(screen.queryByText("대시보드로 이동")).toBeNull();
    expect(pushMock).toHaveBeenCalledWith("/auth/post-auth?intent=login");
  });

  it("routes users who finished consent but have no goal to onboarding", () => {
    renderWithIntl(<Hero authStatus="pending-learning-goal" />);

    fireEvent.click(
      screen.getByRole("button", { name: "학습 목표 설정하기" }),
    );

    expect(pushMock).toHaveBeenCalledWith("/onboarding/learning-goal");
  });

  it("keeps dashboard CTA only for fully ready users", () => {
    renderWithIntl(<LandingHeader authStatus="ready" />);

    const dashboardLink = screen.getByRole("link", { name: "대시보드로 이동" });
    expect(dashboardLink.getAttribute("href")).toBe("/dashboard");
  });

  it("routes landing recovery users back into post-auth setup", () => {
    renderWithIntl(<Hero authStatus="authenticated-recovery" />);

    fireEvent.click(screen.getByRole("button", { name: "설정 계속하기" }));

    expect(pushMock).toHaveBeenCalledWith("/auth/post-auth?intent=login");
  });

  it("keeps anonymous Portfolio CTAs on sign-up and login", () => {
    renderWithIntl(<PortfolioLandingLayout authStatus="anonymous" />);

    const startLinks = screen.getAllByRole("link", { name: "시작하기" });
    const startHrefs = startLinks.map((link) => link.getAttribute("href"));

    expect(startHrefs).toContain("/sign-up");
    expect(startHrefs).toContain("/login");
    expect(screen.getByRole("link", { name: "로그인" }).getAttribute("href")).toBe(
      "/login",
    );
  });

  it("renders Learning Loop image assets in the preview cards", () => {
    renderWithIntl(<PortfolioLandingLayout authStatus="anonymous" />);

    const previewImages = Array.from(
      document.querySelectorAll<HTMLImageElement>(
        "#preview .landing-layout-work img",
      ),
    );

    expect(
      previewImages.map((image) =>
        decodeURIComponent(image.getAttribute("src") ?? ""),
      ),
    ).toEqual([
      "/assets/landing/landing-loop-dashboard.png",
      "/assets/landing/landing-loop-feedback.png",
      "/assets/landing/landing-loop-report.png",
    ].map((assetPath) => expect.stringContaining(assetPath)));
  });

  it("renders Core Value image assets in the service cards", () => {
    renderWithIntl(<PortfolioLandingLayout authStatus="anonymous" />);

    const serviceImages = Array.from(
      document.querySelectorAll<HTMLImageElement>(
        "#services .landing-layout-service__frame img",
      ),
    );

    expect(
      serviceImages.map((image) =>
        decodeURIComponent(image.getAttribute("src") ?? ""),
      ),
    ).toEqual([
      "/assets/core-value-01.png",
      "/assets/core-value-02.png",
      "/assets/core-value-03.png",
    ].map((assetPath) => expect.stringContaining(assetPath)));
    expect(
      document.querySelectorAll(
        "#services .landing-layout-service__frame .landing-layout-number",
      ),
    ).toHaveLength(0);
  });

  it("renders Future Scope mascot image assets in the post cards", () => {
    renderWithIntl(<PortfolioLandingLayout authStatus="anonymous" />);

    const futureImages = Array.from(
      document.querySelectorAll<HTMLImageElement>("#blog .landing-layout-post img"),
    );

    expect(
      futureImages.map((image) =>
        decodeURIComponent(image.getAttribute("src") ?? ""),
      ),
    ).toEqual([
      "/assets/landing-future-vocabulary.png",
      "/assets/landing-future-exam.png",
      "/assets/landing-future-board.png",
    ].map((assetPath) => expect.stringContaining(assetPath)));
  });

  it("renders Learner Goals comments with avatar images", () => {
    renderWithIntl(<PortfolioLandingLayout authStatus="anonymous" />);
    const pageText = document.body.textContent ?? "";

    expect(pageText).toContain(
      "D-30, 오늘 할 일은?\n목표 급수까지 남은 거리를 한눈에 보고 싶어요.",
    );
    expect(pageText).toContain(
      "점수만 보고 끝내기엔 아쉬워요.\n어떤 문장을 어떻게 고칠지 바로 알고 싶습니다.",
    );
    expect(pageText).toContain(
      "전에 틀린 표현, 또 틀리고 싶지 않아요.\n피드백을 모아두고 반복해서 확인할래요.",
    );
    expect(pageText).toContain(
      "시험 전엔 시간이 제일 부족하니까,\n내 약점에 맞는 문제부터 바로 풀고 싶습니다!",
    );

    const avatarImages = Array.from(
      document.querySelectorAll<HTMLImageElement>(
        ".landing-layout-testimonials__avatar img",
      ),
    );
    expect(
      avatarImages.map((image) =>
        decodeURIComponent(image.getAttribute("src") ?? ""),
      ),
    ).toEqual([
      "/assets/avatar/cat.png",
      "/assets/avatar/rabbit.png",
      "/assets/avatar/penguin.png",
      "/assets/avatar/panda.png",
    ].map((assetPath) => expect.stringContaining(assetPath)));
  });

  it.each([
    ["pending-consent", "약관 동의하고 계속하기", "/auth/post-auth?intent=login"],
    ["pending-learning-goal", "학습 목표 설정하기", "/onboarding/learning-goal"],
    ["ready", "대시보드로 이동", "/dashboard"],
    ["authenticated-recovery", "설정 계속하기", "/auth/post-auth?intent=login"],
  ] as const)(
    "uses the %s primary CTA throughout the authenticated Portfolio landing",
    (authStatus, label, href) => {
      renderWithIntl(<PortfolioLandingLayout authStatus={authStatus} />);

      const primaryLinks = screen.getAllByRole("link", { name: label });
      expect(primaryLinks.length).toBeGreaterThanOrEqual(3);
      for (const link of primaryLinks) {
        expect(link.getAttribute("href")).toBe(href);
      }

      expect(document.querySelector('a[href="/sign-up"]')).toBeNull();
      expect(document.querySelector('a[href="/login"]')).toBeNull();
    },
  );
});
