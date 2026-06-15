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
