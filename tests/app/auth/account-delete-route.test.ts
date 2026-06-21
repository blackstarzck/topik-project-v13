import { beforeEach, describe, expect, it, vi } from "vitest";

const helpers = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () =>
    Promise.resolve({
      auth: { getUser: helpers.getUser, signOut: helpers.signOut },
      rpc: helpers.rpc,
    }),
}));

import { NextRequest } from "next/server";

import { GET, POST } from "../../../src/app/auth/account-delete/route";

function postRequest() {
  return new NextRequest("http://localhost/auth/account-delete", {
    method: "POST",
  });
}

describe("/auth/account-delete route handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    helpers.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    helpers.rpc.mockResolvedValue({ error: null });
    helpers.signOut.mockResolvedValue({ error: null });
  });

  it("redirects to /login when unauthenticated", async () => {
    helpers.getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(postRequest());
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/login");
    expect(helpers.rpc).not.toHaveBeenCalled();
  });

  it("calls request_account_deletion + global signOut, then redirects withdrawn", async () => {
    const res = await POST(postRequest());
    expect(helpers.rpc).toHaveBeenCalledWith("request_account_deletion");
    expect(helpers.signOut).toHaveBeenCalledWith({ scope: "global" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/login?reason=withdrawn");
  });

  it("redirects to settings with delete=error when the RPC fails", async () => {
    helpers.rpc.mockResolvedValue({ error: { code: "P0001", message: "x" } });
    const res = await POST(postRequest());
    expect(res.headers.get("location")).toContain(
      "/settings/account?delete=error",
    );
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
