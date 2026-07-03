// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { App as AntdApp } from "antd";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";

import { LibraryActionsPanel } from "../../../src/components/library/LibraryActionsPanel";
import koMessages from "../../../messages/ko.json";

function renderLibrary(ui: ReactElement) {
  return render(
    <NextIntlClientProvider locale="ko" messages={koMessages}>
      <AntdApp>{ui}</AntdApp>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  if (!(globalThis as Record<string, unknown>).ResizeObserver) {
    (globalThis as Record<string, unknown>).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("LibraryActionsPanel", () => {
  it("renders without a card wrapper or section padding", () => {
    renderLibrary(
      <LibraryActionsPanel
        selection={[]}
        reviewPending={false}
        onExportClick={() => undefined}
        onCreateReviewSet={() => undefined}
      />,
    );

    expect(screen.getByTestId("library-actions").className).not.toContain(
      "ant-card",
    );
    expect(
      screen.getByTestId("library-selection-count").className,
    ).not.toContain("ant-tag");
  });

  it("stacks the CTA buttons vertically and makes each CTA fill the panel width", () => {
    renderLibrary(
      <LibraryActionsPanel
        selection={[{ itemId: "item-1", title: "저장 답안" }]}
        reviewPending={false}
        onExportClick={() => undefined}
        onCreateReviewSet={() => undefined}
      />,
    );

    expect(screen.getByTestId("library-actions-stack").className).toContain(
      "flex-col",
    );
    expect(screen.getByTestId("library-export-pdf").className).toContain(
      "ant-btn-block",
    );
    expect(screen.getByTestId("library-create-review-set").className).toContain(
      "ant-btn-block",
    );
  });

  it("keeps both CTAs disabled until the user selects at least one saved answer", () => {
    renderLibrary(
      <LibraryActionsPanel
        selection={[]}
        reviewPending={false}
        onExportClick={() => undefined}
        onCreateReviewSet={() => undefined}
      />,
    );

    expect(screen.getByTestId("library-selection-count").textContent).toContain(
      "0",
    );
    expect(screen.getByTestId("library-export-pdf")).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByTestId("library-create-review-set")).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByTestId("library-selection-hint").className).toContain(
      "text-sm",
    );
  });
});
