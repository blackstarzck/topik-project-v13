import { describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirectMock(path),
}));

import ClaimAffiliationPage from "../../../src/app/auth/claim-affiliation/page";

function renderClaimAffiliationPage(searchParams: Record<string, string>) {
  return ClaimAffiliationPage({
    searchParams: Promise.resolve(searchParams),
  });
}

describe("/auth/claim-affiliation", () => {
  it("redirects the legacy claim route to the institution invite confirmation", async () => {
    await expect(
      renderClaimAffiliationPage({
        next: "/auth/post-auth?intent=sign-up",
      }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(redirectMock).toHaveBeenCalledWith(
      "/auth/institution-invite?next=%2Fauth%2Fpost-auth%3Fintent%3Dsign-up",
    );
  });

  it("falls back when next is absolute", async () => {
    await expect(
      renderClaimAffiliationPage({
        next: "https://evil.example",
      }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(redirectMock).toHaveBeenCalledWith(
      "/auth/institution-invite?next=%2Fauth%2Fpost-auth%3Fintent%3Dsign-up",
    );
  });
});
