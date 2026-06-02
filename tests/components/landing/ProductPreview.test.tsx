// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { App as AntdApp } from "antd";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";

import { ProductPreview } from "../../../src/components/landing/ProductPreview";
import koMessages from "../../../messages/ko.json";

// The landing.preview.* catalog is merged into messages/ko.json by the
// coordinator. Render against the real ko catalog (same Korean strings the
// assertions match) so this stays green without depending on messages/_staging/.

function renderLanding(ui: ReactElement) {
  return render(
    <NextIntlClientProvider locale="ko" messages={koMessages}>
      <AntdApp>{ui}</AntdApp>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  // Ant Design touches ResizeObserver + matchMedia, which jsdom omits.
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
  vi.restoreAllMocks();
});

describe("ProductPreview i18n copy", () => {
  it("renders the section heading and body from landing.preview", () => {
    renderLanding(<ProductPreview />);
    expect(screen.getByText("써보기 전에 미리 보기")).toBeTruthy();
    expect(
      screen.getByText(
        "실제 화면 그대로의 대시보드, 피드백, 리포트를 확인해보세요.",
      ),
    ).toBeTruthy();
  });

  it("renders the three preview card badges and titles", () => {
    renderLanding(<ProductPreview />);
    // Badges (emoji + label) render inside the CSS-only screen mock.
    expect(screen.getByText("📊 대시보드")).toBeTruthy();
    expect(screen.getByText("✍️ AI 피드백")).toBeTruthy();
    expect(screen.getByText("📈 성장 리포트")).toBeTruthy();
    // Card titles + a summary resolved from the catalog.
    expect(screen.getByText("학습 현황 한눈에")).toBeTruthy();
    expect(screen.getByText("차원별 첨삭")).toBeTruthy();
    expect(screen.getByText("점수 변화 비교")).toBeTruthy();
    expect(
      screen.getByText(
        "오늘의 목표, 최근 제출, 추천 문제를 홈에서 바로 확인합니다.",
      ),
    ).toBeTruthy();
  });
});
