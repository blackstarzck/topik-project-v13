// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("@/components/auth/ClaimAffiliationRedirect", () => ({
  ClaimAffiliationRedirect: ({ nextPath }: { nextPath: string }) => (
    <div data-next={nextPath} data-testid="claim-affiliation-redirect" />
  ),
}));

import ClaimAffiliationPage from "../../../src/app/auth/claim-affiliation/page";

afterEach(() => {
  cleanup();
});

function renderClaimAffiliationPage(searchParams: Record<string, string>) {
  return ClaimAffiliationPage({
    searchParams: Promise.resolve(searchParams),
  });
}

describe("/auth/claim-affiliation", () => {
  it("passes a relative next path to the client bridge", async () => {
    render(
      await renderClaimAffiliationPage({
        next: "/auth/post-auth?intent=sign-up",
      }),
    );

    expect(
      screen
        .getByTestId("claim-affiliation-redirect")
        .getAttribute("data-next"),
    ).toBe("/auth/post-auth?intent=sign-up");
  });

  it("falls back when next is absolute", async () => {
    render(
      await renderClaimAffiliationPage({
        next: "https://evil.example",
      }),
    );

    expect(
      screen
        .getByTestId("claim-affiliation-redirect")
        .getAttribute("data-next"),
    ).toBe("/auth/post-auth?intent=sign-up");
  });
});
