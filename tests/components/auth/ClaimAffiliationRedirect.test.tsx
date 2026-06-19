// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";

const replaceMock = vi.fn();
const claimStoredAffiliationCodeMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock("@/lib/auth/affiliation-code", () => ({
  claimStoredAffiliationCode: (...args: unknown[]) =>
    claimStoredAffiliationCodeMock(...args),
}));

import { ClaimAffiliationRedirect } from "../../../src/components/auth/ClaimAffiliationRedirect";

beforeEach(() => {
  replaceMock.mockReset();
  claimStoredAffiliationCodeMock.mockReset();
  claimStoredAffiliationCodeMock.mockResolvedValue("claimed");
});

afterEach(() => {
  cleanup();
});

describe("ClaimAffiliationRedirect", () => {
  it("claims the stored affiliation code before continuing to next", async () => {
    render(<ClaimAffiliationRedirect nextPath="/auth/post-auth?intent=sign-up" />);

    await waitFor(() => {
      expect(claimStoredAffiliationCodeMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith(
        "/auth/post-auth?intent=sign-up",
      );
    });
  });

  it("continues to next even when claim fails", async () => {
    claimStoredAffiliationCodeMock.mockResolvedValueOnce("failed");

    render(<ClaimAffiliationRedirect nextPath="/auth/post-auth?intent=sign-up" />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith(
        "/auth/post-auth?intent=sign-up",
      );
    });
  });
});
