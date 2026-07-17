// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
}));

import { WritingPageContent } from "@/components/writing/WritingPageContent";

afterEach(() => cleanup());

describe("WritingPageContent empty state", () => {
  it("uses a destination-neutral label for contextual return navigation", async () => {
    const element = await WritingPageContent({
      questionNo: 51,
      userId: "user-1",
      problem: null,
      draft: null,
      canRetryProblemLoad: false,
      returnHref: "/dashboard",
    });

    render(element);

    const returnLink = screen.getByRole("link", {
      name: "writing.editor.back",
    });
    expect(returnLink.getAttribute("href")).toBe("/dashboard");
  });
});
