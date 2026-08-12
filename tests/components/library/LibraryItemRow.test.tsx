// @vitest-environment jsdom
import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import koMessages from "../../../messages/ko.json";
import { LibraryItemRow } from "../../../src/components/library/LibraryItemRow";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

vi.mock("@/lib/library/mutations", () => ({
  useDeleteLibraryItem: () => ({
    isPending: false,
    mutate: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("LibraryItemRow actions", () => {
  it("keeps tags readable without exposing the old tag edit control", () => {
    renderWithIntl(
      <LibraryItemRow
        userId="user-1"
        itemId="item-1"
        tab="submissions"
        tags={["grammar"]}
      >
        <span>Saved answer row</span>
      </LibraryItemRow>,
    );

    expect(screen.getByText("grammar")).toBeTruthy();
    expect(
      screen.queryByRole("button", {
        name: koMessages.library.item.editTags,
      }),
    ).toBeNull();
    expect(
      screen.queryByLabelText(koMessages.library.item.tagsInputAriaLabel),
    ).toBeNull();
  });

  it("renders delete as a flat icon-only danger button with a label", () => {
    renderWithIntl(
      <LibraryItemRow
        userId="user-1"
        itemId="item-1"
        tab="submissions"
        tags={[]}
      >
        <span>Saved answer row</span>
      </LibraryItemRow>,
    );

    const deleteButton = screen.getByRole("button", {
      name: koMessages.library.item.delete,
    });

    expect(deleteButton.textContent?.trim()).toBe("");
    expect(deleteButton.getAttribute("title")).toBe(
      koMessages.library.item.delete,
    );
    expect(deleteButton.className).toContain("ant-btn-text");
    expect(deleteButton.className).toContain("ant-btn-dangerous");
    expect(deleteButton.querySelector("svg")).toBeTruthy();
  });
});
