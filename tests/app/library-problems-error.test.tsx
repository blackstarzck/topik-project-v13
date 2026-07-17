// @vitest-environment jsdom
import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import LibraryProblemsError from "@/app/(workspace)/library/problems/error";
import { APP_ROUTES } from "@/lib/routes";
import { renderWithIntl } from "../test-utils/renderWithIntl";

afterEach(() => {
  cleanup();
});

describe("LibraryProblemsError", () => {
  it("returns to the library with replace navigation", () => {
    renderWithIntl(<LibraryProblemsError reset={vi.fn()} />);

    const backControl = screen.getByRole("link", {
      name: /서재|library/i,
    });

    expect(backControl.getAttribute("href")).toBe(APP_ROUTES.library);
    expect(backControl.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
  });
});
