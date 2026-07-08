import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const helpers = vi.hoisted(() => ({
  deleteTalkpikAccountProfile: vi.fn(),
  getTalkpikApiBaseUrl: vi.fn(),
  getSession: vi.fn(),
  getUser: vi.fn(),
  rpc: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/talkpik-api/account", () => ({
  deleteTalkpikAccountProfile: helpers.deleteTalkpikAccountProfile,
  getTalkpikApiBaseUrl: helpers.getTalkpikApiBaseUrl,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () =>
    Promise.resolve({
      auth: {
        getSession: helpers.getSession,
        getUser: helpers.getUser,
        signOut: helpers.signOut,
      },
      rpc: helpers.rpc,
    }),
}));

import { NextRequest } from "next/server";

import { GET, POST } from "../../../src/app/auth/account-delete/route";

function postRequest(
  headers: HeadersInit = {},
  url = "http://localhost/auth/account-delete",
) {
  return new NextRequest(url, {
    method: "POST",
    headers: {
      origin: "http://localhost",
      "sec-fetch-site": "same-origin",
      ...headers,
    },
  });
}

describe("/auth/account-delete route handler", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    helpers.getTalkpikApiBaseUrl.mockReturnValue("https://api.example.test");
    helpers.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    helpers.getSession.mockResolvedValue({
      data: { session: { access_token: "learner-token" } },
    });
    helpers.deleteTalkpikAccountProfile.mockResolvedValue(undefined);
    helpers.rpc.mockResolvedValue({ error: null });
    helpers.signOut.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("rejects cross-site POST requests before reading session state", async () => {
    const res = await POST(
      postRequest({
        origin: "https://evil.example",
        "sec-fetch-site": "cross-site",
      }),
    );

    expect(res.status).toBe(403);
    expect(helpers.getUser).not.toHaveBeenCalled();
    expect(helpers.getSession).not.toHaveBeenCalled();
    expect(helpers.deleteTalkpikAccountProfile).not.toHaveBeenCalled();
    expect(helpers.rpc).not.toHaveBeenCalled();
  });

  it("accepts same-origin browser POSTs when the public host differs from the internal request URL", async () => {
    const res = await POST(
      postRequest(
        {
          host: "127.0.0.1:3010",
          origin: "http://127.0.0.1:3010",
        },
        "http://localhost:3000/auth/account-delete",
      ),
    );

    expect(res.status).toBe(303);
    expect(helpers.deleteTalkpikAccountProfile).toHaveBeenCalledOnce();
    expect(helpers.rpc).toHaveBeenCalledWith("request_account_deletion");
  });

  it("redirects to /login when unauthenticated", async () => {
    helpers.getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(postRequest());
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/login");
    expect(helpers.getSession).not.toHaveBeenCalled();
    expect(helpers.deleteTalkpikAccountProfile).not.toHaveBeenCalled();
    expect(helpers.rpc).not.toHaveBeenCalled();
  });

  it("deletes the external profile before local RPC + global signOut, then redirects withdrawn", async () => {
    const res = await POST(postRequest());
    expect(helpers.deleteTalkpikAccountProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: "learner-token",
        baseUrl: "https://api.example.test",
      }),
    );
    expect(helpers.rpc).toHaveBeenCalledWith("request_account_deletion");
    expect(
      helpers.deleteTalkpikAccountProfile.mock.invocationCallOrder[0],
    ).toBeLessThan(helpers.rpc.mock.invocationCallOrder[0]);
    expect(helpers.signOut).toHaveBeenCalledWith({ scope: "global" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/login?reason=withdrawn");
  });

  it("redirects to settings without local deletion when the external base URL is missing", async () => {
    helpers.getTalkpikApiBaseUrl.mockReturnValue(null);

    const res = await POST(postRequest());

    expect(res.headers.get("location")).toContain(
      "/settings/account?delete=error",
    );
    expect(helpers.deleteTalkpikAccountProfile).not.toHaveBeenCalled();
    expect(helpers.rpc).not.toHaveBeenCalled();
    expect(helpers.signOut).not.toHaveBeenCalled();
  });

  it("redirects to settings without local deletion when the access token is missing", async () => {
    helpers.getSession.mockResolvedValue({ data: { session: null } });

    const res = await POST(postRequest());

    expect(res.headers.get("location")).toContain(
      "/settings/account?delete=error",
    );
    expect(helpers.deleteTalkpikAccountProfile).not.toHaveBeenCalled();
    expect(helpers.rpc).not.toHaveBeenCalled();
    expect(helpers.signOut).not.toHaveBeenCalled();
  });

  it("redirects to settings without local deletion when external profile deletion fails", async () => {
    helpers.deleteTalkpikAccountProfile.mockRejectedValue(
      new Error("external failed"),
    );

    const res = await POST(postRequest());

    expect(res.headers.get("location")).toContain(
      "/settings/account?delete=error",
    );
    expect(helpers.rpc).not.toHaveBeenCalled();
    expect(helpers.signOut).not.toHaveBeenCalled();
  });

  it("continues local deletion when the external profile is already gone", async () => {
    helpers.deleteTalkpikAccountProfile.mockRejectedValue(
      Object.assign(new Error("external profile not found"), { status: 404 }),
    );

    const res = await POST(postRequest());

    expect(helpers.rpc).toHaveBeenCalledWith("request_account_deletion");
    expect(helpers.signOut).toHaveBeenCalledWith({ scope: "global" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/login?reason=withdrawn");
  });

  it("keeps error redirects on the public browser origin", async () => {
    helpers.deleteTalkpikAccountProfile.mockRejectedValue(
      new Error("external failed"),
    );

    const res = await POST(
      postRequest(
        {
          host: "127.0.0.1:3010",
          origin: "http://127.0.0.1:3010",
        },
        "http://localhost:3000/auth/account-delete",
      ),
    );

    expect(res.headers.get("location")).toBe(
      "http://127.0.0.1:3010/settings/account?delete=error",
    );
    expect(helpers.rpc).not.toHaveBeenCalled();
  });

  it("redirects to settings with delete=error when the RPC fails", async () => {
    helpers.rpc.mockResolvedValue({ error: { code: "P0001", message: "x" } });
    const res = await POST(postRequest());
    expect(res.headers.get("location")).toContain(
      "/settings/account?delete=error",
    );
    expect(helpers.deleteTalkpikAccountProfile).toHaveBeenCalledOnce();
    expect(helpers.signOut).not.toHaveBeenCalled();
  });

  it("still redirects withdrawn even if signOut fails (status already set)", async () => {
    helpers.signOut.mockResolvedValue({ error: { message: "network" } });
    const res = await POST(postRequest());
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/login?reason=withdrawn");
  });

  it("rejects GET with 405", async () => {
    const res = await GET();
    expect(res.status).toBe(405);
  });
});
