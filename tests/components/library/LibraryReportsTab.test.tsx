// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import koMessages from "../../../messages/ko.json";
import { LibraryReportsTab } from "../../../src/components/library/LibraryReportsTab";
import type { LibraryReportView } from "../../../src/lib/library/types";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

vi.mock("@/lib/library/queries", () => ({
  useLibraryItems: vi.fn(),
}));

import { useLibraryItems } from "@/lib/library/queries";

const mockedUseLibraryItems = vi.mocked(useLibraryItems);

function renderTab(initialItems: LibraryReportView[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return renderWithIntl(
    <QueryClientProvider client={queryClient}>
      <LibraryReportsTab userId="user-1" initialItems={initialItems} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockedUseLibraryItems.mockReturnValue({
    data: undefined,
    isLoading: false,
    error: null,
  } as never);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("LibraryReportsTab row actions", () => {
  it("does not render a row-level PDF export button", () => {
    const reports: LibraryReportView[] = [
      {
        kind: "report",
        id: "report-1",
        generated_at: "2026-06-01T00:00:00.000Z",
        narrative_excerpt: "Comparison report summary",
        item_id: "library-report-1",
        tags: ["report"],
      },
    ];

    renderTab(reports);

    expect(screen.getByText(koMessages.library.reports.title)).toBeTruthy();
    expect(
      screen.queryByRole("button", {
        name: koMessages.library.exportButton.label,
      }),
    ).toBeNull();
  });
});
