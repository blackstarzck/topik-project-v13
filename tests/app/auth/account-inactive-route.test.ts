import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const helpers = vi.hoisted(() => ({
  signOut: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () =>
    Promise.resolve({
      auth: { signOut: helpers.signOut },
    }),
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
    helpers.signOut.mockResolvedValue({ error: null });
  });

  it("clears the local session and maps deleted → reason=withdrawn", async () => {
    const res = await GET(request("deleted"));
    expect(helpers.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/login?reason=withdrawn");
  });

  it("maps blocked → reason=blocked", async () => {
    const res = await GET(request("blocked"));
    expect(res.headers.get("location")).toContain("/login?reason=blocked");
  });

  it("defaults an unknown/missing status to reason=withdrawn", async () => {
    const res = await GET(request());
    expect(res.headers.get("location")).toContain("/login?reason=withdrawn");
  });

  it("still redirects when signOut fails", async () => {
    helpers.signOut.mockResolvedValue({ error: { message: "network" } });
    const res = await GET(request("deleted"));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/login?reason=withdrawn");
  });
});
