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
import { ACCOUNT_DELETION_CONFIRMATION_TEXT } from "../../../src/lib/auth/account-deletion";

function postRequest(
  headers: HeadersInit = {},
  url = "http://localhost/auth/account-delete",
  confirmation: string | null = ACCOUNT_DELETION_CONFIRMATION_TEXT.ko,
) {
  const body = new URLSearchParams();
  if (confirmation !== null) body.set("confirmation", confirmation);
  return new NextRequest(url, {
    method: "POST",
    body,
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
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost");
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
    vi.unstubAllEnvs();
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

  it("rejects POST requests without an Origin header", async () => {
    const res = await POST(
      postRequest({
        origin: "",
        "sec-fetch-site": "none",
      }),
    );

    expect(res.status).toBe(403);
    expect(helpers.getUser).not.toHaveBeenCalled();
    expect(helpers.rpc).not.toHaveBeenCalled();
  });

  it("rejects a null Origin header", async () => {
    const res = await POST(postRequest({ origin: "null" }));

    expect(res.status).toBe(403);
    expect(helpers.getUser).not.toHaveBeenCalled();
    expect(helpers.rpc).not.toHaveBeenCalled();
  });

  it("rejects an empty POST before reading session state", async () => {
    const res = await POST(postRequest({}, undefined, null));

    expect(res.status).toBe(400);
    expect(helpers.getUser).not.toHaveBeenCalled();
    expect(helpers.deleteTalkpikAccountProfile).not.toHaveBeenCalled();
    expect(helpers.rpc).not.toHaveBeenCalled();
  });

  it("rejects a POST whose server-side confirmation does not match", async () => {
    const res = await POST(postRequest({}, undefined, "delete"));

    expect(res.status).toBe(400);
    expect(helpers.getUser).not.toHaveBeenCalled();
    expect(helpers.deleteTalkpikAccountProfile).not.toHaveBeenCalled();
    expect(helpers.rpc).not.toHaveBeenCalled();
  });

  it.each(Object.values(ACCOUNT_DELETION_CONFIRMATION_TEXT))(
    "accepts the approved confirmation value %s",
    async (confirmation) => {
      const res = await POST(
        postRequest({ accept: "application/json" }, undefined, confirmation),
      );

      expect(res.status).toBe(200);
      expect(helpers.rpc).toHaveBeenCalledWith("request_account_deletion");
    },
  );

  it.each([
    ` ${ACCOUNT_DELETION_CONFIRMATION_TEXT.ko}`,
    `${ACCOUNT_DELETION_CONFIRMATION_TEXT.en} `,
    "delete",
    "Xoa",
  ])(
    "rejects non-exact confirmation value %s before reading session state",
    async (confirmation) => {
      const res = await POST(postRequest({}, undefined, confirmation));

      expect(res.status).toBe(400);
      expect(helpers.getUser).not.toHaveBeenCalled();
      expect(helpers.rpc).not.toHaveBeenCalled();
    },
  );

  it("accepts same-origin browser POSTs when the public host differs from the internal request URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://127.0.0.1:3010");
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

  it("never trusts forwarded or Host headers as the account-deletion origin", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.example.test");

    const res = await POST(
      postRequest(
        {
          host: "evil.example",
          "x-forwarded-host": "evil.example",
          "x-forwarded-proto": "https",
          origin: "https://evil.example",
          "sec-fetch-site": "same-origin",
        },
        "http://localhost:3000/auth/account-delete",
      ),
    );

    expect(res.status).toBe(403);
    expect(helpers.getUser).not.toHaveBeenCalled();
    expect(helpers.rpc).not.toHaveBeenCalled();
  });

  it("rejects a foreign Origin even when Sec-Fetch-Site is missing", async () => {
    const res = await POST(
      postRequest({
        origin: "https://evil.example",
        "sec-fetch-site": "",
      }),
    );

    expect(res.status).toBe(403);
    expect(helpers.getUser).not.toHaveBeenCalled();
  });

  it("rejects a foreign Origin even when Sec-Fetch-Site says same-origin", async () => {
    const res = await POST(
      postRequest({
        origin: "https://evil.example",
        "sec-fetch-site": "same-origin",
      }),
    );

    expect(res.status).toBe(403);
    expect(helpers.getUser).not.toHaveBeenCalled();
  });

  // Regression: `request.url` is not the origin the browser addressed. Next
  // pins its hostname to the server's own origin and ignores `Host`, so the
  // non-production fallback trusted the wrong authority — with
  // NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000 and a dev server on :3001 the
  // trusted set was {http://127.0.0.1:3000, http://localhost:3001}, and a
  // browser at http://127.0.0.1:3001 was refused its own deletion.
  describe("non-production loopback fallback", () => {
    const devServerUrl = "http://localhost:3001/auth/account-delete";

    it("accepts a loopback POST from a host neither the configured origin nor request.url names", async () => {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://127.0.0.1:3000");

      const res = await POST(
        postRequest(
          { host: "127.0.0.1:3001", origin: "http://127.0.0.1:3001" },
          devServerUrl,
        ),
      );

      expect(res.status).toBe(303);
      expect(res.headers.get("location")).toContain("/login?reason=withdrawn");
      expect(helpers.rpc).toHaveBeenCalledWith("request_account_deletion");
    });

    it.each([
      ["an IPv4 loopback", "127.0.0.1:3001", "http://127.0.0.1:3001"],
      ["an IPv6 loopback", "[::1]:3001", "http://[::1]:3001"],
      ["a named loopback", "localhost:3001", "http://localhost:3001"],
    ])(
      "accepts %s browser origin when no site origin is configured",
      async (_name, host, origin) => {
        vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");

        const res = await POST(postRequest({ host, origin }, devServerUrl));

        expect(res.status).toBe(303);
        expect(helpers.rpc).toHaveBeenCalledWith("request_account_deletion");
      },
    );

    // `redirectUrl()` derived its fallback base from `request.url` too, so the
    // loopback fallback bounced the browser to the server's own hostname.
    it("redirects back to the addressed host when no site origin is configured", async () => {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");

      const res = await POST(
        postRequest(
          { host: "127.0.0.1:3001", origin: "http://127.0.0.1:3001" },
          devServerUrl,
        ),
      );

      expect(res.headers.get("location")).toBe(
        "http://127.0.0.1:3001/login?reason=withdrawn",
      );
    });

    it("keeps error redirects on the addressed host when no site origin is configured", async () => {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
      helpers.deleteTalkpikAccountProfile.mockRejectedValue(
        new Error("external failed"),
      );

      const res = await POST(
        postRequest(
          { host: "127.0.0.1:3001", origin: "http://127.0.0.1:3001" },
          devServerUrl,
        ),
      );

      expect(res.headers.get("location")).toBe(
        "http://127.0.0.1:3001/settings/account?delete=error",
      );
      expect(helpers.rpc).not.toHaveBeenCalled();
    });

    // A dev server picks its port at boot — :3000 taken means :3001, then
    // :3002 — so no static NEXT_PUBLIC_SITE_URL can track the port a parallel
    // worktree lands on. Outside production the redirect therefore follows the
    // authority the browser actually addressed, not the configured one, or the
    // deletion would succeed and then bounce the browser to a dead port.
    it("redirects to the addressed port even when a different origin is configured", async () => {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://127.0.0.1:3000");

      const res = await POST(
        postRequest(
          { host: "127.0.0.1:3001", origin: "http://127.0.0.1:3001" },
          devServerUrl,
        ),
      );

      expect(res.headers.get("location")).toBe(
        "http://127.0.0.1:3001/login?reason=withdrawn",
      );
    });

    it("keeps error redirects on the addressed port when a different origin is configured", async () => {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://127.0.0.1:3000");
      helpers.deleteTalkpikAccountProfile.mockRejectedValue(
        new Error("external failed"),
      );

      const res = await POST(
        postRequest(
          { host: "127.0.0.1:3001", origin: "http://127.0.0.1:3001" },
          devServerUrl,
        ),
      );

      expect(res.headers.get("location")).toBe(
        "http://127.0.0.1:3001/settings/account?delete=error",
      );
    });

    it("redirects unauthenticated callers to the addressed port", async () => {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://127.0.0.1:3000");
      helpers.getUser.mockResolvedValue({ data: { user: null } });

      const res = await POST(
        postRequest(
          { host: "127.0.0.1:3001", origin: "http://127.0.0.1:3001" },
          devServerUrl,
        ),
      );

      expect(res.headers.get("location")).toBe("http://127.0.0.1:3001/login");
    });

    // The browser-addressed authority must never reach a production redirect
    // base: `NEXT_PUBLIC_SITE_URL` stays authoritative there, and the internal
    // request URL is never used.
    it("builds production redirects from the configured origin only", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.example.test");

      const res = await POST(
        postRequest(
          { host: "app.example.test", origin: "https://app.example.test" },
          "https://internal.vercel.test/auth/account-delete",
        ),
      );

      expect(res.headers.get("location")).toBe(
        "https://app.example.test/login?reason=withdrawn",
      );
    });

    // The fallback must widen nothing beyond a loopback authority the browser
    // itself addressed, and `x-forwarded-*` must never be consulted.
    it.each([
      [
        "the Origin port differs from the addressed port",
        { host: "127.0.0.1:3001", origin: "http://127.0.0.1:4000" },
      ],
      [
        "the Origin host differs from the addressed loopback host",
        { host: "127.0.0.1:3001", origin: "https://evil.example" },
      ],
      [
        "the addressed host is not a loopback authority",
        { host: "evil.example", origin: "https://evil.example" },
      ],
      [
        "only a forwarded header claims the loopback authority",
        {
          host: "evil.example",
          "x-forwarded-host": "127.0.0.1:3001",
          "x-forwarded-proto": "http",
          origin: "http://127.0.0.1:3001",
        },
      ],
      [
        "the Host header is absent",
        { host: "", origin: "http://127.0.0.1:3001" },
      ],
      [
        "the Host header is not a bare authority",
        {
          host: "127.0.0.1:3001/@evil.example",
          origin: "http://127.0.0.1:3001",
        },
      ],
    ])(
      "rejects the loopback fallback when %s",
      async (_name, headers: Record<string, string>) => {
        vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");

        const res = await POST(postRequest(headers, devServerUrl));

        expect(res.status).toBe(403);
        expect(helpers.getUser).not.toHaveBeenCalled();
        expect(helpers.rpc).not.toHaveBeenCalled();
      },
    );

    it("does not extend the loopback fallback to production", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.example.test");

      const res = await POST(
        postRequest(
          { host: "127.0.0.1:3001", origin: "http://127.0.0.1:3001" },
          devServerUrl,
        ),
      );

      expect(res.status).toBe(403);
      expect(helpers.getUser).not.toHaveBeenCalled();
      expect(helpers.rpc).not.toHaveBeenCalled();
    });

    it("keeps NEXT_PUBLIC_SITE_URL authoritative in production", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.example.test");

      const res = await POST(
        postRequest(
          {
            host: "app.example.test",
            origin: "https://app.example.test",
            accept: "application/json",
          },
          "https://internal.vercel.test/auth/account-delete",
        ),
      );

      expect(res.status).toBe(200);
      expect(helpers.rpc).toHaveBeenCalledWith("request_account_deletion");
    });
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

  it("returns a minimal success response for the client cleanup handshake", async () => {
    const res = await POST(postRequest({ accept: "application/json" }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
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
    const privateProviderMessage = "private provider failure payload";
    helpers.deleteTalkpikAccountProfile.mockRejectedValue(
      new Error(privateProviderMessage),
    );

    const res = await POST(postRequest());

    expect(res.headers.get("location")).toContain(
      "/settings/account?delete=error",
    );
    expect(helpers.rpc).not.toHaveBeenCalled();
    expect(helpers.signOut).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith("account_delete_failed", {
      stage: "external_profile",
    });
    expect(JSON.stringify(consoleErrorSpy.mock.calls)).not.toContain(
      privateProviderMessage,
    );
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
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://127.0.0.1:3010");
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

  it("does not confirm client cleanup when account deletion fails", async () => {
    helpers.rpc.mockResolvedValue({ error: { code: "P0001", message: "x" } });

    const res = await POST(postRequest({ accept: "application/json" }));

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ ok: false });
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
