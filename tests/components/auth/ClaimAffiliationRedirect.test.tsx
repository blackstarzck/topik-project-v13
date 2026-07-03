// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";

const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

import { ClaimAffiliationRedirect } from "../../../src/components/auth/ClaimAffiliationRedirect";

beforeEach(() => {
  replaceMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("ClaimAffiliationRedirect", () => {
  it("redirects the deprecated bridge to explicit invite confirmation", async () => {
    render(
      <ClaimAffiliationRedirect nextPath="/auth/post-auth?intent=sign-up" />,
    );

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith(
        "/auth/institution-invite?next=%2Fauth%2Fpost-auth%3Fintent%3Dsign-up",
      );
    });
  });
});
