// @vitest-environment jsdom
import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "../../test-utils/renderWithIntl";

import { AuthConsentPanel } from "../../../src/components/auth/AuthConsentPanel";

afterEach(() => {
  cleanup();
});

describe("AuthConsentPanel", () => {
  it("renders missing consent documents and the submit action", () => {
    renderWithIntl(
      <AuthConsentPanel
        action={vi.fn()}
        documents={[
          {
            id: "terms-1",
            title: "Terms of Service",
            version: "2026-06",
            summary: "Short consent summary",
            body: "Full consent body",
          },
        ]}
        next="/auth/post-auth?intent=login"
        showRequiredError={false}
      />,
    );

    expect(screen.getByText("Terms of Service")).toBeTruthy();
    expect(screen.getByText("Short consent summary")).toBeTruthy();
    expect(screen.getByText("Full consent body")).toBeTruthy();
    expect(screen.getByRole("button")).toBeTruthy();
  });
});
