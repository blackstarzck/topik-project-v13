import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL =
    "https://fglggyfvzjdsbyckinqa.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
  delete process.env.VERCEL_ENV;
  mockGetUser.mockReset();
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

async function callMiddleware(url: string) {
  const { NextRequest } = await import("next/server");
  const { proxy } = await import("../../src/proxy");
  const request = new NextRequest(new URL(url));
  return proxy(request);
}

import {
  APP_ROUTES,
  APP_ROUTE_SPECS,
  PROTECTED_ROUTE_CASES,
  PUBLIC_PATHS,
} from "../../src/lib/routes";

const PROTECTED_PATHS = PROTECTED_ROUTE_CASES.map((c) => c.path);

it("keeps the system report API outside page middleware lists", () => {
  expect(
    APP_ROUTE_SPECS.find((route) => route.path === APP_ROUTES.apiSystemReports),
  ).toEqual(expect.objectContaining({ middleware: "excluded" }));
  expect(PUBLIC_PATHS).not.toContain(APP_ROUTES.apiSystemReports);
  expect(PROTECTED_PATHS).not.toContain(APP_ROUTES.apiSystemReports);
});

describe("route matrix — anonymous context", () => {
  it("does not expose the old dev preview route to anonymous users", async () => {
    expect(PUBLIC_PATHS).not.toContain("/dev-preview");

    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const response = await callMiddleware(
      "http://localhost/dev-preview/dashboard",
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });

  for (const path of PUBLIC_PATHS) {
    it(`allows anon to access ${path}`, async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
      const response = await callMiddleware(`http://localhost${path}`);
      expect(response.status).toBe(200);
    });
  }

  for (const path of PROTECTED_PATHS) {
    it(`redirects anon from ${path} to /login`, async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
      const response = await callMiddleware(`http://localhost${path}`);
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/login");
    });
  }
});

describe("route matrix — authenticated context (middleware-level)", () => {
  // Middleware does not perform role-based gating; it only checks
  // authentication. There are no admin routes in this app (the admin console
  // lives in the separate topik-ai app); role values remain only as RLS
  // policy inputs (see `tests/lib/auth/profile-getCurrentProfile.test.ts`).
  for (const path of PROTECTED_PATHS) {
    it(`lets authenticated user pass through ${path}`, async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
        error: null,
      });
      const response = await callMiddleware(`http://localhost${path}`);
      expect(response.status).toBe(200);
    });
  }
});
