// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replaceAction = vi.hoisted(() => vi.fn());

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/lib/writing/server-actions", () => ({
  replaceStaleWritingDraftAction: replaceAction,
}));

import { StaleDraftVersionAlert } from "../../../src/components/writing/StaleDraftVersionAlert";

describe("StaleDraftVersionAlert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 360,
    });
  });

  it("keeps the recovery action visible at the mobile viewport and reports failures", async () => {
    replaceAction.mockRejectedValueOnce(new Error("network"));
    render(
      <StaleDraftVersionAlert
        draftId="draft-1"
        questionId="topik-writing-54-0001"
        importId="321"
        payloadHash="hash-321"
      />,
    );

    expect(screen.getByText("staleDraftTitle")).not.toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "staleDraftReplaceAction" }),
    );

    await waitFor(() =>
      expect(replaceAction).toHaveBeenCalledWith({
        draftId: "draft-1",
        questionId: "topik-writing-54-0001",
        importId: "321",
        payloadHash: "hash-321",
      }),
    );
    expect(await screen.findByText("staleDraftReplaceFailed")).not.toBeNull();
  });
});
