import { beforeEach, describe, expect, it, vi } from "vitest";

const helpers = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: helpers.getUser },
  }),
}));

vi.mock("@/lib/supabase/service-role.server", () => ({
  createSupabaseServiceRoleClient: () => ({
    rpc: helpers.rpc,
  }),
}));

import * as route from "../../../src/app/api/system-reports/route";
import { SYSTEM_REPORT_MAX_BODY_BYTES } from "../../../src/lib/system-reports";

const idempotencyKey = "2f1d4b86-44cf-4d66-8a23-2d1bf847c21a";
const report = {
  category: "bug",
  email: "learner@example.com",
  title: "Dashboard does not load",
  message: "The dashboard remains blank after I sign in.",
  context: {
    pathname: "/dashboard",
    browser: "chrome",
    os: "windows",
    deviceType: "desktop",
    viewportWidth: 1440,
    viewportHeight: 900,
    locale: "ko",
  },
} as const;

function postRequest(
  body: BodyInit | null = JSON.stringify(report),
  headers: HeadersInit = {},
  url = "http://localhost/api/system-reports",
) {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
      origin: "http://localhost",
      "sec-fetch-site": "same-origin",
      ...headers,
    },
    body,
  });
}

describe("POST /api/system-reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    helpers.getUser.mockResolvedValue({
      data: { user: { id: "5a4b5f57-c559-4311-a2db-5bde811c1595" } },
      error: null,
    });
    helpers.rpc.mockResolvedValue({
      data: [
        {
          reference_code: "SR-0123456789ABCDEF",
          created_at: "2026-07-23T08:00:00.000Z",
          inserted: true,
        },
      ],
      error: null,
    });
  });

  it("exports only the POST handler", () => {
    expect(route.POST).toBeTypeOf("function");
    expect("GET" in route).toBe(false);
  });

  it("injects the authenticated user and exact allowlisted RPC parameters", async () => {
    process.env.VERCEL_GIT_COMMIT_SHA =
      "0123456789abcdef0123456789abcdef01234567";

    const response = await route.POST(postRequest());

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      referenceCode: "SR-0123456789ABCDEF",
      createdAt: "2026-07-23T08:00:00.000Z",
    });
    expect(helpers.rpc).toHaveBeenCalledWith("submit_system_report", {
      p_idempotency_key: idempotencyKey,
      p_user_id: "5a4b5f57-c559-4311-a2db-5bde811c1595",
      p_category: "bug",
      p_email: "learner@example.com",
      p_title: "Dashboard does not load",
      p_message: "The dashboard remains blank after I sign in.",
      p_pathname: "/dashboard",
      p_browser: "chrome",
      p_os: "windows",
      p_device_type: "desktop",
      p_viewport_width: 1440,
      p_viewport_height: 900,
      p_locale: "ko",
      p_app_version: "0123456789ab",
    });
  });

  it("maps an idempotent duplicate to 200", async () => {
    helpers.rpc.mockResolvedValueOnce({
      data: [
        {
          reference_code: "SR-0123456789ABCDEF",
          created_at: "2026-07-23T08:00:00.000Z",
          inserted: false,
        },
      ],
      error: null,
    });

    const response = await route.POST(postRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      referenceCode: "SR-0123456789ABCDEF",
      createdAt: "2026-07-23T08:00:00.000Z",
    });
  });

  it("continues anonymously when the optional auth lookup fails", async () => {
    helpers.getUser.mockRejectedValueOnce(new Error("auth unavailable"));

    const response = await route.POST(postRequest());

    expect(response.status).toBe(201);
    expect(helpers.rpc).toHaveBeenCalledWith(
      "submit_system_report",
      expect.objectContaining({ p_user_id: null }),
    );
  });

  it.each([
    [
      "non-JSON content",
      () =>
        postRequest(JSON.stringify(report), { "content-type": "text/plain" }),
    ],
    [
      "cross-origin request",
      () =>
        postRequest(JSON.stringify(report), {
          origin: "https://evil.example",
          "sec-fetch-site": "cross-site",
        }),
    ],
    [
      "missing browser origin",
      () => {
        const request = postRequest();
        request.headers.delete("origin");
        return request;
      },
    ],
    [
      "invalid idempotency key",
      () =>
        postRequest(JSON.stringify(report), { "idempotency-key": "not-uuid" }),
    ],
    ["malformed JSON", () => postRequest("{not-json")],
    [
      "privacy field",
      () => postRequest(JSON.stringify({ ...report, userId: "browser-user" })),
    ],
  ])(
    "returns 400 without storage access for %s",
    async (_name, makeRequest) => {
      const response = await route.POST(makeRequest());

      expect(response.status).toBe(400);
      expect(helpers.getUser).not.toHaveBeenCalled();
      expect(helpers.rpc).not.toHaveBeenCalled();
    },
  );

  it("rejects a declared oversized body before parsing", async () => {
    const response = await route.POST(
      postRequest("{}", {
        "content-length": String(SYSTEM_REPORT_MAX_BODY_BYTES + 1),
      }),
    );

    expect(response.status).toBe(413);
    expect(helpers.getUser).not.toHaveBeenCalled();
    expect(helpers.rpc).not.toHaveBeenCalled();
  });

  it("rejects a streamed oversized body while reading", async () => {
    const response = await route.POST(
      postRequest("a".repeat(SYSTEM_REPORT_MAX_BODY_BYTES + 1)),
    );

    expect(response.status).toBe(413);
    expect(helpers.getUser).not.toHaveBeenCalled();
    expect(helpers.rpc).not.toHaveBeenCalled();
  });

  it("returns a generic 503 without exposing storage errors", async () => {
    const privateError = "private database failure";
    helpers.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: privateError },
    });

    const response = await route.POST(postRequest());
    const text = await response.text();

    expect(response.status).toBe(503);
    expect(text).not.toContain(privateError);
    expect(JSON.parse(text)).toEqual({ error: "service_unavailable" });
  });

  it("returns a generic 503 for malformed storage responses", async () => {
    helpers.rpc.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const response = await route.POST(postRequest());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "service_unavailable",
    });
  });
});
