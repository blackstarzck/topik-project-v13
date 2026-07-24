// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";

import { renderWithIntl } from "../../test-utils/renderWithIntl";
import { LibraryWorkspace } from "../../../src/components/library/LibraryWorkspace";

const emptyLibraryItems: never[] = [];

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/library/queries", () => ({
  useLibraryItems: () => ({
    data: emptyLibraryItems,
    isLoading: false,
    error: null,
  }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("LibraryWorkspace layout", () => {
  it("keeps the right stats rail full-height and sticky on desktop", () => {
    renderWithIntl(
      <LibraryWorkspace
        userId="user-1"
        activeTab="submissions"
        initialItems={[]}
        stats={{
          savedCount: 3,
          avgScore: 82,
          weakestDimension: "grammar",
          reviewCount: 1,
          lastUpdated: null,
        }}
      />,
    );

    const grid = screen.getByTestId("library-workspace-grid");
    const statsColumn = screen.getByTestId("library-stats-column");

    expect(grid.className).toContain("items-stretch");
    expect(statsColumn.className).toContain("library-stats-column");
    expect(statsColumn.className).toContain("lg:self-start");
    expect(statsColumn.className).toContain("lg:h-[calc(");
    expect(screen.getByTestId("library-stats-panel").className).toContain(
      "h-full",
    );
    expect(screen.getByTestId("library-stats-actions").className).toContain(
      "mt-auto",
    );
    expect(screen.getByTestId("library-stats-actions").className).toContain(
      "library-stats-actions",
    );
  });
});
