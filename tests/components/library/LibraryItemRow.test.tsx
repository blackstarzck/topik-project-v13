// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import koMessages from "../../../messages/ko.json";
import { LibraryItemRow } from "../../../src/components/library/LibraryItemRow";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

const deleteMutateMock = vi.hoisted(() => vi.fn());
const globalCss = readFileSync("src/styles/global.css", "utf8");
const libraryItemRowSource = readFileSync(
  "src/components/library/LibraryItemRow.tsx",
  "utf8",
);

vi.mock("@/lib/library/mutations", () => ({
  useDeleteLibraryItem: () => ({
    isPending: false,
    mutate: deleteMutateMock,
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
    expect(deleteButton.className).not.toContain("library-item-delete-button");
    expect(deleteButton.querySelector("svg")).toBeTruthy();
    expect(globalCss).not.toContain(".library-item-delete-button");
    expect(libraryItemRowSource).not.toContain(
      'className="library-item-delete-button"',
    );
  });

  it("keeps the confirmation gate before deleting a library item", async () => {
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

    fireEvent.click(
      screen.getByRole("button", { name: koMessages.library.item.delete }),
    );
    expect(deleteMutateMock).not.toHaveBeenCalled();
    expect(
      await screen.findByText(koMessages.library.item.deleteConfirmTitle),
    ).toBeTruthy();

    const confirmButtons = screen.getAllByRole("button", {
      name: koMessages.library.item.delete,
    });
    fireEvent.click(confirmButtons.at(-1)!);

    await waitFor(() => {
      expect(deleteMutateMock).toHaveBeenCalledWith(
        { itemId: "item-1", tab: "submissions" },
        expect.objectContaining({
          onError: expect.any(Function),
          onSuccess: expect.any(Function),
        }),
      );
    });
  });
});
