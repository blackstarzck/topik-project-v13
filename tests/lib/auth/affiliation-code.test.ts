// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import {
  AFFILIATION_CODE_STORAGE_KEY,
  buildAffiliationMetadata,
  captureAffiliationCodeFromSearch,
  clearStoredAffiliationCode,
  readStoredAffiliationCode,
  storeAffiliationCode,
} from "../../../src/lib/auth/affiliation-code";

const NOW = Date.UTC(2026, 5, 19, 10, 0, 0);
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function readRawStoredValue() {
  const raw = window.localStorage.getItem(AFFILIATION_CODE_STORAGE_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as {
    code: string;
    capturedAt: number;
    expiresAt: number;
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("affiliation code storage", () => {
  it("stores a valid aff search param with a 24 hour expiry", () => {
    const captured = captureAffiliationCodeFromSearch(
      new URLSearchParams("aff=EXPO2026-BOOTH-A"),
      NOW,
    );

    expect(captured).toBe("EXPO2026-BOOTH-A");
    expect(readRawStoredValue()).toEqual({
      code: "EXPO2026-BOOTH-A",
      capturedAt: NOW,
      expiresAt: NOW + ONE_DAY_MS,
    });
  });

  it("ignores invalid aff values without replacing an existing valid code", () => {
    storeAffiliationCode("EXPO2026-BOOTH-A", NOW);

    const captured = captureAffiliationCodeFromSearch(
      new URLSearchParams("aff=https://evil.example"),
      NOW + 1_000,
    );

    expect(captured).toBeNull();
    expect(readStoredAffiliationCode(NOW + 1_000)).toBe("EXPO2026-BOOTH-A");
  });

  it("keeps the stored value readable after a reload-equivalent read", () => {
    storeAffiliationCode("EXPO2026-BOOTH-A", NOW);

    expect(readStoredAffiliationCode(NOW + 60_000)).toBe("EXPO2026-BOOTH-A");
    expect(buildAffiliationMetadata(NOW + 60_000)).toEqual({
      affiliation_code: "EXPO2026-BOOTH-A",
    });
  });

  it("deletes expired values when read", () => {
    storeAffiliationCode("EXPO2026-BOOTH-A", NOW);

    expect(readStoredAffiliationCode(NOW + ONE_DAY_MS + 1)).toBeNull();
    expect(window.localStorage.getItem(AFFILIATION_CODE_STORAGE_KEY)).toBeNull();
  });

  it("clears the stored value on demand", () => {
    storeAffiliationCode("EXPO2026-BOOTH-A", NOW);

    clearStoredAffiliationCode();

    expect(readStoredAffiliationCode(NOW)).toBeNull();
  });
});
