// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { App as AntdApp } from "antd";
import { NextIntlClientProvider } from "next-intl";

import enMessages from "../../../messages/en.json";
import koMessages from "../../../messages/ko.json";
import viMessages from "../../../messages/vi.json";
import { PortfolioLandingLayout } from "../../../src/components/landing/PortfolioLandingLayout";
import { DEFAULT_TIME_ZONE, type Locale } from "../../../src/i18n/locales";

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
      toArray: vi.fn(() => []),
    },
  },
}));

vi.mock("gsap/ScrollTrigger", () => ({
  ScrollTrigger: {
    refresh: vi.fn(),
  },
}));

vi.mock("swiper/modules", () => ({
  Autoplay: {},
  FreeMode: {},
}));

vi.mock("swiper/react", () => ({
  Swiper: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SwiperSlide: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const messagesByLocale = {
  ko: koMessages,
  en: enMessages,
  vi: viMessages,
};

function renderLanding(locale: Locale) {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={messagesByLocale[locale]}
      timeZone={DEFAULT_TIME_ZONE}
    >
      <AntdApp>
        <PortfolioLandingLayout authStatus="anonymous" />
      </AntdApp>
    </NextIntlClientProvider>,
  );
}

afterEach(cleanup);

describe("PortfolioLandingLayout locale catalog", () => {
  it.each([
    ["ko", "학습 현황부터", "TOPIK 학습자가", "이용약관"],
    ["en", "From learning progress", "What TOPIK learners", "Terms"],
    ["vi", "Từ tiến độ học tập", "Điều người học TOPIK", "Điều khoản"],
  ] as const)(
    "renders the main landing sections in %s",
    (locale, coreHeading, learnerHeading, termsLabel) => {
      renderLanding(locale);

      expect(screen.getByText(coreHeading, { exact: false })).toBeTruthy();
      expect(screen.getByText(learnerHeading, { exact: false })).toBeTruthy();
      expect(screen.getByRole("link", { name: termsLabel })).toBeTruthy();
    },
  );

  it.each(["en", "vi"] as const)(
    "does not leave the Korean core heading visible in %s",
    (locale) => {
      renderLanding(locale);

      expect(screen.queryByText("학습 현황부터", { exact: false })).toBeNull();
    },
  );
});
