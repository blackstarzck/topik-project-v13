// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";

import { AffiliationCodeCapture } from "../../../src/components/auth/AffiliationCodeCapture";
import {
  AFFILIATION_CODE_STORAGE_KEY,
  readStoredAffiliationCode,
} from "../../../src/lib/auth/affiliation-code";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe("AffiliationCodeCapture", () => {
  it("captures aff from the current URL and removes only that query param", async () => {
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
  });
});
