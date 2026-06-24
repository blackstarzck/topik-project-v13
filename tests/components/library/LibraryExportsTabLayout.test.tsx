// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";

import { renderWithIntl } from "../../test-utils/renderWithIntl";
import { LibraryExportsTab } from "../../../src/components/library/LibraryExportsTab";

vi.mock("../../../src/lib/library/queries", () => ({
  useLibraryItems: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("LibraryExportsTab layout", () => {
  it("centers the empty export state inside a fill-height tab body", () => {
    renderWithIntl(<LibraryExportsTab initialItems={[]} />);

    const tabBody = screen.getByTestId("library-tab-body");
    const emptyState = screen.getByTestId("library-empty-state");

    expect(tabBody.className).toContain("flex-1");
    expect(tabBody.className).toContain("min-h-0");
    expect(emptyState.className).toContain("flex-1");
    expect(emptyState.className).toContain("items-center");
    expect(emptyState.className).toContain("justify-center");
    expect(screen.getByText("내보내기 기록이 없습니다.")).toBeTruthy();
  });
});
