// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { PortfolioLandingLayout } from "../../../src/components/landing/PortfolioLandingLayout";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

const scrollTriggerMocks = vi.hoisted(() => ({
  create: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("gsap", () => ({
  gsap: {
    context: (callback: () => void) => {
      callback();
      return { revert: vi.fn() };
    },
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
      toArray: vi.fn((selector: string) =>
        Array.from(document.querySelectorAll(selector)),
      ),
    },
  },
}));

vi.mock("gsap/ScrollTrigger", () => ({
  ScrollTrigger: scrollTriggerMocks,
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

describe("PortfolioLandingLayout motion", () => {
  it("keeps rendering when ScrollTrigger setup fails for nonessential triggers", () => {
    const originalIntersectionObserver = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = class {
      observe() {}
      disconnect() {}
      unobserve() {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
      root = null;
      rootMargin = "";
      thresholds = [];
    } as unknown as typeof IntersectionObserver;

    scrollTriggerMocks.create.mockImplementationOnce(() => {
      throw new TypeError(
        "Cannot read properties of undefined (reading 'end')",
      );
    });

    try {
      expect(() =>
        renderWithIntl(<PortfolioLandingLayout authStatus="anonymous" />),
      ).not.toThrow();
    } finally {
      globalThis.IntersectionObserver = originalIntersectionObserver;
    }
  });
});
