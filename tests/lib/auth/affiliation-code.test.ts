// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AFFILIATION_CODE_STORAGE_KEY,
  acceptStoredAffiliationInvite,
  buildAffiliationMetadata,
  captureAffiliationCodeFromSearch,
  clearStoredAffiliationCode,
  claimStoredAffiliationCode,
  readStoredAffiliationCode,
  storeAffiliationCode,
} from "../../../src/lib/auth/affiliation-code";

const rpcMock = vi.fn();
const getUserMock = vi.fn();
const maybeSingleProfileMock = vi.fn();
const eqProfileMock = vi.fn(() => ({ maybeSingle: maybeSingleProfileMock }));
const selectProfileMock = vi.fn(() => ({ eq: eqProfileMock }));
const fromMock = vi.fn((table: string) => {
  void table;
  return { select: selectProfileMock };
});

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getUser: () => getUserMock(),
    },
    from: (table: string) => fromMock(table),
    rpc: (fn: string, args?: unknown) => rpcMock(fn, args),
  }),
}));

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
  rpcMock.mockReset();
  getUserMock.mockReset();
  maybeSingleProfileMock.mockReset();
  eqProfileMock.mockClear();
  selectProfileMock.mockClear();
  fromMock.mockClear();
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
    expect(
      window.localStorage.getItem(AFFILIATION_CODE_STORAGE_KEY),
    ).toBeNull();
  });

  it("clears the stored value on demand", () => {
    storeAffiliationCode("EXPO2026-BOOTH-A", NOW);

    clearStoredAffiliationCode();

    expect(readStoredAffiliationCode(NOW)).toBeNull();
  });
});

describe("affiliation invite acceptance", () => {
  it("does not call the RPC when no stored code exists", async () => {
    await expect(acceptStoredAffiliationInvite(NOW)).resolves.toBe("empty");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("accepts a stored code through the confirmed invite RPC and clears it", async () => {
    storeAffiliationCode("EXPO2026-BOOTH-A", NOW);
    rpcMock.mockResolvedValueOnce({
      data: { status: "accepted" },
      error: null,
    });

    await expect(acceptStoredAffiliationInvite(NOW)).resolves.toBe("accepted");

    expect(rpcMock).toHaveBeenCalledWith("accept_affiliation_invite", {
      p_code: "EXPO2026-BOOTH-A",
      p_confirmed: true,
    });
    expect(readStoredAffiliationCode(NOW)).toBeNull();
  });

  it("maps no-switch and error statuses without silently claiming another institution", async () => {
    storeAffiliationCode("EXPO2026-BOOTH-A", NOW);
    rpcMock.mockResolvedValueOnce({
      data: { status: "already_affiliated_other" },
      error: null,
    });

    await expect(acceptStoredAffiliationInvite(NOW)).resolves.toBe(
      "already_affiliated_other",
    );

    expect(readStoredAffiliationCode(NOW)).toBe("EXPO2026-BOOTH-A");
  });

  it("falls back to the legacy claim RPC when the confirmed invite RPC is not deployed", async () => {
    storeAffiliationCode("EXPO2026-BOOTH-A", NOW);
    rpcMock
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: "PGRST202",
          message:
            "Could not find the function public.accept_affiliation_invite(p_code, p_confirmed) in the schema cache",
        },
      })
      .mockResolvedValueOnce({
        data: "EXPO2026-BOOTH-A",
        error: null,
      });
    getUserMock.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
      error: null,
    });
    maybeSingleProfileMock.mockResolvedValueOnce({
      data: { affiliation_code: "EXPO2026-BOOTH-A", status: "active" },
      error: null,
    });

    await expect(acceptStoredAffiliationInvite(NOW)).resolves.toBe("accepted");

    expect(rpcMock).toHaveBeenNthCalledWith(1, "accept_affiliation_invite", {
      p_code: "EXPO2026-BOOTH-A",
      p_confirmed: true,
    });
    expect(rpcMock).toHaveBeenNthCalledWith(2, "claim_affiliation_code", {
      p_code: "EXPO2026-BOOTH-A",
    });
    expect(fromMock).toHaveBeenCalledWith("profiles");
    expect(eqProfileMock).toHaveBeenCalledWith("id", "user-1");
    expect(readStoredAffiliationCode(NOW)).toBeNull();
  });

  it("keeps the stored code when the legacy fallback reveals another existing affiliation", async () => {
    storeAffiliationCode("EXPO2026-BOOTH-A", NOW);
    rpcMock
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: "PGRST202",
          message:
            "Could not find the function public.accept_affiliation_invite(p_code, p_confirmed) in the schema cache",
        },
      })
      .mockResolvedValueOnce({
        data: "EXPO2026-BOOTH-A",
        error: null,
      });
    getUserMock.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
      error: null,
    });
    maybeSingleProfileMock.mockResolvedValueOnce({
      data: { affiliation_code: "OTHER-INSTITUTION", status: "active" },
      error: null,
    });

    await expect(acceptStoredAffiliationInvite(NOW)).resolves.toBe(
      "already_affiliated_other",
    );

    expect(readStoredAffiliationCode(NOW)).toBe("EXPO2026-BOOTH-A");
  });

  it("keeps the deprecated claim helper as a wrapper without using the old RPC", async () => {
    storeAffiliationCode("EXPO2026-BOOTH-A", NOW);
    rpcMock.mockResolvedValueOnce({
      data: { status: "already_affiliated_same" },
      error: null,
    });

    await expect(claimStoredAffiliationCode(NOW)).resolves.toBe("claimed");

    expect(rpcMock).toHaveBeenCalledWith("accept_affiliation_invite", {
      p_code: "EXPO2026-BOOTH-A",
      p_confirmed: true,
    });
    expect(readStoredAffiliationCode(NOW)).toBeNull();
  });
});
