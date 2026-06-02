// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { App as AntdApp } from "antd";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";

import { LibraryStatsPanel } from "../../../src/components/library/LibraryStatsPanel";
import { PdfExportModal } from "../../../src/components/library/PdfExportModal";
import koMessages from "../../../messages/ko.json";

// The `library.*` catalog is now merged into messages/ko.json. Render against the
// real ko catalog (same Korean strings the assertions match) so these stay green
// without depending on the ephemeral messages/_staging/ dir.

function renderLibrary(ui: ReactElement) {
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

describe("LibraryStatsPanel i18n chrome", () => {
  it("renders the empty state from the library.stats namespace", () => {
    renderLibrary(
      <LibraryStatsPanel
        stats={{
          savedCount: 0,
          avgScore: null,
          weakestDimension: null,
          reviewCount: 0,
          lastUpdated: null,
        }}
      />,
    );
    expect(screen.getByText("내 서재 통계")).toBeTruthy();
    expect(screen.getByText("아직 저장한 자료가 없어요.")).toBeTruthy();
    expect(screen.getByText("문제 풀러 가기")).toBeTruthy();
  });

  it("renders the stat labels and resolves the weakest dimension label", () => {
    renderLibrary(
      <LibraryStatsPanel
        stats={{
          savedCount: 12,
          avgScore: 78,
          weakestDimension: "grammar",
          reviewCount: 3,
          lastUpdated: null,
        }}
      />,
    );
    expect(screen.getByText("저장 수")).toBeTruthy();
    expect(screen.getByText("평균 점수")).toBeTruthy();
    expect(screen.getByText("복습 현황")).toBeTruthy();
    // dimension code resolved through library.stats.dimensions.
    expect(screen.getByText("문법")).toBeTruthy();
    // formatUpdated falls back to the no-update copy when lastUpdated is null.
    expect(screen.getByText("갱신 기록 없음")).toBeTruthy();
  });
});

describe("PdfExportModal i18n chrome", () => {
  it("renders the selection-lost exception when the selection is empty", () => {
    renderLibrary(
      <PdfExportModal open onClose={() => undefined} selection={[]} />,
    );
    expect(screen.getByText("선택한 항목을 찾을 수 없어요")).toBeTruthy();
    expect(screen.getByText("목록으로 돌아가기")).toBeTruthy();
  });

  it("renders the PDF option form and CTA when a selection is present", () => {
    renderLibrary(
      <PdfExportModal
        open
        onClose={() => undefined}
        selection={[{ itemId: "item-1", title: "문제 abcd1234" }]}
      />,
    );
    // Region 2 option form labels.
    expect(screen.getByText("파일명")).toBeTruthy();
    expect(screen.getByText("포함 항목")).toBeTruthy();
    expect(screen.getByText("내 답안 포함")).toBeTruthy();
    expect(screen.getByText("AI 피드백 포함")).toBeTruthy();
    // Region 4 primary CTA (idle phase).
    expect(screen.getByRole("button", { name: "PDF 내보내기" })).toBeTruthy();
  });
});
