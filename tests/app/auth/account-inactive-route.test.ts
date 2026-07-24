import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import {
  APP_ROUTES,
  AUTH_ENTRY_PATHS,
  PUBLIC_PATHS,
} from "../../../src/lib/routes";

const helpers = vi.hoisted(() => ({
  createClient: vi.fn(),
  eq: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
  rpc: vi.fn(),
  select: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => helpers.createClient(),
}));

import { GET } from "../../../src/app/auth/account-inactive/route";

function request(status?: string) {
  const url = status
    ? `http://localhost/auth/account-inactive?status=${status}`
    : "http://localhost/auth/account-inactive";
  return new NextRequest(url);
}

describe("/auth/account-inactive route handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    helpers.createClient.mockResolvedValue({
      auth: {
        getUser: helpers.getUser,
        signOut: helpers.signOut,
      },
      rpc: helpers.rpc,
      from: helpers.from,
    });
    helpers.from.mockReturnValue({ select: helpers.select });
    helpers.select.mockReturnValue({ eq: helpers.eq });
    helpers.eq.mockReturnValue({ maybeSingle: helpers.maybeSingle });
    helpers.maybeSingle.mockResolvedValue({
      data: { id: "user-1", status: "deleted" },
      error: null,
    });
    helpers.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    helpers.rpc.mockResolvedValue({ data: "deleted", error: null });
    helpers.signOut.mockResolvedValue({ error: null });
  });

  it("verifies deleted state before clearing the local session", async () => {
    const res = await GET(request("deleted"));
    expect(helpers.createClient).toHaveBeenCalledTimes(1);
    expect(helpers.getUser).toHaveBeenCalledTimes(1);
    expect(helpers.rpc).toHaveBeenCalledWith("get_my_account_state");
    expect(helpers.from).not.toHaveBeenCalled();
    expect(helpers.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/login?reason=withdrawn");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("derives blocked reason from the verified database state", async () => {
    helpers.rpc.mockResolvedValue({ data: "blocked", error: null });

    const res = await GET(request("deleted"));

    expect(helpers.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(res.headers.get("location")).toContain("/login?reason=blocked");
  });

  it("ignores a forged query status for an active account", async () => {
    helpers.rpc.mockResolvedValue({ data: "active", error: null });

    const res = await GET(request("deleted"));

    expect(helpers.signOut).not.toHaveBeenCalled();
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://localhost/dashboard");
  });

  it("does not mutate the session when unauthenticated", async () => {
    helpers.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const res = await GET(request("blocked"));

    expect(helpers.rpc).not.toHaveBeenCalled();
    expect(helpers.signOut).not.toHaveBeenCalled();
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://localhost/login");
  });

  it("fails closed without session mutation when auth verification fails", async () => {
    helpers.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "auth unavailable" },
    });

    const res = await GET(request("deleted"));

    expect(helpers.rpc).not.toHaveBeenCalled();
    expect(helpers.signOut).not.toHaveBeenCalled();
    expect(PUBLIC_PATHS).toContain(APP_ROUTES.authError);
    expect(AUTH_ENTRY_PATHS).not.toContain(APP_ROUTES.authError);
    expect(res.headers.get("location")).toBe(
      "http://localhost/auth/error?reason=unknown",
    );
  });

  it("uses the public recovery route without a profile fallback for non-missing RPC errors", async () => {
    helpers.rpc.mockResolvedValue({
      data: null,
      error: { code: "PGRST500", message: "rpc unavailable" },
    });

    const res = await GET(request("blocked"));

    expect(helpers.from).not.toHaveBeenCalled();
    expect(helpers.signOut).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe(
      "http://localhost/auth/error?reason=unknown",
    );
  });

  it("fails closed for an unknown account state", async () => {
    helpers.rpc.mockResolvedValue({ data: "unexpected", error: null });

    const res = await GET(request("deleted"));

    expect(helpers.signOut).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe(
      "http://localhost/auth/error?reason=unknown",
    );
  });

  it("uses public recovery instead of login when signOut returns an error", async () => {
    helpers.signOut.mockResolvedValue({ error: { message: "network" } });
    const res = await GET(request("deleted"));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(
      "http://localhost/auth/error?reason=unknown",
    );
  });

  it("uses public recovery instead of login when signOut throws", async () => {
    helpers.signOut.mockRejectedValue(new Error("network"));

    const res = await GET(request("deleted"));

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(
      "http://localhost/auth/error?reason=unknown",
    );
  });

  it("fails closed without session mutation when auth verification throws", async () => {
    helpers.getUser.mockRejectedValue(new Error("auth unavailable"));

    const res = await GET(request("deleted"));

    expect(helpers.rpc).not.toHaveBeenCalled();
    expect(helpers.signOut).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe(
      "http://localhost/auth/error?reason=unknown",
    );
  });

  it("fails closed when the request-bound auth client cannot be created", async () => {
    helpers.createClient.mockRejectedValue(new Error("client unavailable"));

    const res = await GET(request("deleted"));

    expect(helpers.getUser).not.toHaveBeenCalled();
    expect(helpers.rpc).not.toHaveBeenCalled();
    expect(helpers.signOut).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe(
      "http://localhost/auth/error?reason=unknown",
    );
  });

  it("falls back to the JWT/RLS-owned profile only when the RPC is missing", async () => {
    helpers.rpc.mockResolvedValue({
      data: null,
      error: { code: "PGRST202", message: "function missing" },
    });
    helpers.maybeSingle.mockResolvedValue({
      data: { id: "user-1", status: "active" },
      error: null,
    });

    const res = await GET(request("deleted"));

    expect(helpers.from).toHaveBeenCalledWith("profiles");
    expect(helpers.select).toHaveBeenCalledWith("id, status");
    expect(helpers.eq).toHaveBeenCalledWith("id", "user-1");
    expect(helpers.maybeSingle).toHaveBeenCalledTimes(1);
    expect(helpers.signOut).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe("http://localhost/dashboard");
  });

  it("uses a verified inactive fallback state until the RPC migration is deployed", async () => {
    helpers.rpc.mockResolvedValue({
      data: null,
      error: { code: "PGRST202", message: "function missing" },
    });
    helpers.maybeSingle.mockResolvedValue({
      data: { id: "user-1", status: "blocked" },
      error: null,
    });

    const res = await GET(request("active"));

    expect(helpers.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(res.headers.get("location")).toBe(
      "http://localhost/login?reason=blocked",
    );
  });

  it("rejects fallback profile rows that do not belong to the authenticated user", async () => {
    helpers.rpc.mockResolvedValue({
      data: null,
      error: { code: "PGRST202", message: "function missing" },
    });
    helpers.maybeSingle.mockResolvedValue({
      data: { id: "another-user", status: "deleted" },
      error: null,
    });

    const res = await GET(request("deleted"));

    expect(helpers.eq).toHaveBeenCalledWith("id", "user-1");
    expect(helpers.signOut).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe(
      "http://localhost/auth/error?reason=unknown",
    );
  });

  it.each([
    {
      name: "query error",
      result: { data: null, error: { message: "profile unavailable" } },
    },
    {
      name: "unknown status",
      result: { data: { id: "user-1", status: "unexpected" }, error: null },
    },
  ])("fails closed for a fallback profile $name", async ({ result }) => {
    helpers.rpc.mockResolvedValue({
      data: null,
      error: { code: "PGRST202", message: "function missing" },
    });
    helpers.maybeSingle.mockResolvedValue(result);

    const res = await GET(request("deleted"));

    expect(helpers.signOut).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe(
      "http://localhost/auth/error?reason=unknown",
    );
  });
});
