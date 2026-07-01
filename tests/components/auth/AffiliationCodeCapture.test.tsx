// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";

import { AffiliationCodeCapture } from "../../../src/components/auth/AffiliationCodeCapture";
import {
  AFFILIATION_CODE_STORAGE_KEY,
  readStoredAffiliationCode,
} from "../../../src/lib/auth/affiliation-code";

const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => window.location.pathname,
  useRouter: () => ({ replace: replaceMock }),
}));

beforeEach(() => {
  window.localStorage.clear();
  replaceMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("AffiliationCodeCapture", () => {
  it("captures aff from the current URL and redirects public entry points to the canonical invite route", async () => {
    window.history.replaceState(
      null,
      "",
      "http://localhost:3000/sign-up?aff=EXPO2026-BOOTH-A&utm=expo#start",
    );

    render(<AffiliationCodeCapture />);

    await waitFor(() => {
      expect(readStoredAffiliationCode()).toBe("EXPO2026-BOOTH-A");
    });
    expect(window.location.pathname).toBe("/sign-up");
    expect(window.location.search).toBe("?utm=expo");
    expect(window.location.hash).toBe("#start");
    expect(replaceMock).toHaveBeenCalledWith("/auth/institution-invite");
  });

  it("captures aff on the canonical invite route without redirecting again", async () => {
    window.history.replaceState(
      null,
      "",
      "http://localhost:3000/auth/institution-invite?aff=EXPO2026-BOOTH-A",
    );

    render(<AffiliationCodeCapture />);

    await waitFor(() => {
      expect(readStoredAffiliationCode()).toBe("EXPO2026-BOOTH-A");
    });
    expect(window.location.pathname).toBe("/auth/institution-invite");
    expect(window.location.search).toBe("");
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("silently drops invalid aff values from the URL without storing them", async () => {
    window.history.replaceState(
      null,
      "",
      "http://localhost:3000/?aff=https://evil.example&utm=expo",
    );

    render(<AffiliationCodeCapture />);

    await waitFor(() => {
      expect(window.location.search).toBe("?utm=expo");
    });
    expect(window.localStorage.getItem(AFFILIATION_CODE_STORAGE_KEY)).toBeNull();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
