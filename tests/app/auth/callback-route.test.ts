import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getUserMock = vi.fn();
const exchangeCodeForSessionMock = vi.fn();
const verifyOtpMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      exchangeCodeForSession: (...args: unknown[]) =>
        exchangeCodeForSessionMock(...args),
      getUser: (...args: unknown[]) => getUserMock(...args),
      verifyOtp: (...args: unknown[]) => verifyOtpMock(...args),
    },
  }),
}));

import { GET } from "../../../src/app/auth/callback/route";

function request(url: string): NextRequest {
  return new NextRequest(new URL(url));
}

describe("/auth/callback route", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    exchangeCodeForSessionMock.mockReset();
    exchangeCodeForSessionMock.mockResolvedValue({ error: null });
    verifyOtpMock.mockReset();
    verifyOtpMock.mockResolvedValue({ error: null });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exchanges a fresh OAuth code and redirects to sanitized next", async () => {
    const response = await GET(
      request(
        "http://localhost:3000/auth/callback?code=fresh-code&next=%2Fauth%2Fpost-auth%3Fintent%3Dlogin",
      ),
    );

    expect(exchangeCodeForSessionMock).toHaveBeenCalledWith("fresh-code");
    expect(getUserMock).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/auth/post-auth?intent=login",
    );
  });

  it("recovers a stale OAuth callback revisit when an active session exists", async () => {
    exchangeCodeForSessionMock.mockResolvedValueOnce({
      error: {
        code: "bad_code_verifier",
        message: "code verifier mismatch",
        status: 400,
      },
    });
    getUserMock.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
      error: null,
    });

    const response = await GET(
      request(
        "http://localhost:3000/auth/callback?code=used-code&next=%2Fdashboard",
      ),
    );

    expect(exchangeCodeForSessionMock).toHaveBeenCalledWith("used-code");
    expect(getUserMock).toHaveBeenCalledTimes(1);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/dashboard",
    );
    expect(console.error).not.toHaveBeenCalled();
  });

  it("keeps unauthenticated OAuth exchange failures on the auth error flow", async () => {
    exchangeCodeForSessionMock.mockResolvedValueOnce({
      error: {
        code: "bad_code_verifier",
        message: "code verifier mismatch",
        status: 400,
      },
    });
    getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null });

    const response = await GET(
      request("http://localhost:3000/auth/callback?code=bad-code"),
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/auth/error?reason=bad_code_verifier",
    );
    expect(console.error).toHaveBeenCalledTimes(1);
  });
});
