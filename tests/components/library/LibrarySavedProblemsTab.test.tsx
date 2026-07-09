// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import koMessages from "../../../messages/ko.json";
import { LibrarySavedProblemsTab } from "../../../src/components/library/LibrarySavedProblemsTab";
import type { LibraryProblemView } from "../../../src/lib/library/types";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

vi.mock("@/lib/library/queries", () => ({
  useLibraryItems: vi.fn(),
}));

import { useLibraryItems } from "@/lib/library/queries";

const mockedUseLibraryItems = vi.mocked(useLibraryItems);

function renderTab(initialItems: LibraryProblemView[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return renderWithIntl(
    <QueryClientProvider client={queryClient}>
      <LibrarySavedProblemsTab initialItems={initialItems} />
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

describe("LibrarySavedProblemsTab hidden problem UX", () => {
  it("keeps available saved problems retryable", () => {
    renderTab([
      {
        kind: "problem",
        id: "p-available",
        title: "TOPIK 53 chart writing",
        question_no: 53,
        item_id: "li-p-available",
        saved_at: "2026-06-29T10:00:00.000Z",
        tags: ["bookmark"],
        availabilityStatus: "available",
        availabilityReason: null,
        canRetry: true,
      },
    ]);

    const retryLink = screen.getByRole("link", {
      name: koMessages.library.saved.retry,
    });
    expect(retryLink.getAttribute("href")).toBe(
      "/writing/long-form-writing-53?problem=p-available&fresh=1",
    );
    expect(screen.getByTestId("library-item-row").className).toContain(
      "border-[var(--ant-color-border-secondary)]",
    );
    expect(screen.getByTestId("library-item-row").className).not.toContain(
      "border-border",
    );
    expect(screen.getByTestId("library-item-row").className).not.toContain(
      "opacity-40",
    );
    expect(
      screen.queryByTestId("library-problem-unavailable-badge"),
    ).toBeNull();
  });

  it("shows soft-unavailable saved problems with the original title and reason", () => {
    renderTab([
      {
        kind: "problem",
        id: "p-soft",
        title: "TOPIK 52 sentence completion",
        question_no: 52,
        item_id: "li-p-soft",
        saved_at: "2026-06-29T10:00:00.000Z",
        tags: [],
        availabilityStatus: "soft_unavailable",
        availabilityReason: "Rotation ended",
        canRetry: false,
      },
    ]);

    expect(screen.getByText("TOPIK 52 sentence completion")).toBeTruthy();
    expect(
      screen.getByText(koMessages.library.saved.providedEnded),
    ).toBeTruthy();
    expect(screen.getByText("Rotation ended")).toBeTruthy();
    expect(screen.getByTestId("library-item-row").className).toContain(
      "opacity-40",
    );

    expect(
      screen.getByRole("button", {
        name: koMessages.library.saved.retryUnavailable,
      }),
    ).toHaveProperty("disabled", true);
    expect(
      screen.queryByRole("link", { name: koMessages.library.saved.retry }),
    ).toBeNull();
  });

  it("keeps hard-unavailable saved problem rows without exposing problem metadata", () => {
    renderTab([
      {
        kind: "problem",
        id: "p-hard",
        title: null,
        question_no: null,
        item_id: "li-p-hard",
        saved_at: "2026-06-29T10:00:00.000Z",
        tags: ["bookmark"],
        availabilityStatus: "hard_unavailable",
        availabilityReason: null,
        canRetry: false,
      },
    ]);

    expect(
      screen.getByText(koMessages.library.saved.unavailablePlaceholderTitle),
    ).toBeTruthy();
    expect(screen.getByText(koMessages.library.saved.unavailable)).toBeTruthy();
    expect(
      screen.getByText(koMessages.library.saved.unavailableDefaultReason),
    ).toBeTruthy();
    expect(screen.getByTestId("library-item-row").className).toContain(
      "opacity-40",
    );

    expect(
      screen.getByRole("button", {
        name: koMessages.library.saved.retryUnavailable,
      }),
    ).toHaveProperty("disabled", true);
    expect(
      screen.queryByRole("link", { name: koMessages.library.saved.retry }),
    ).toBeNull();
  });
});
