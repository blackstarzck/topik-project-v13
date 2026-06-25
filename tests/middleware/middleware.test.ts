import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
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

describe("middleware route protection", () => {
  it("does not match static media assets", async () => {
    const { config } = await import("../../src/proxy");
    const matcher = new RegExp(`^${config.matcher[0]}$`);

    expect(matcher.test("/dashboard")).toBe(true);
    expect(matcher.test("/icon.png")).toBe(false);
    expect(matcher.test("/apple-icon.png")).toBe(false);
    expect(matcher.test("/assets/landing-hero-video.mp4")).toBe(false);
  });

  it("redirects anon user from /dashboard to /login", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const response = await callMiddleware("http://localhost/dashboard");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });

  it("redirects anon user from a writing route to /login", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const response = await callMiddleware(
      "http://localhost/writing/short-answer-writing-51",
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });

  it("allows anon user to access /login", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const response = await callMiddleware("http://localhost/login");
    expect(response.status).toBe(200);
  });

  it("allows anon user to access /sign-up", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const response = await callMiddleware("http://localhost/sign-up");
    expect(response.status).toBe(200);
  });

  it("redirects authenticated users away from /login", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    const response = await callMiddleware("http://localhost/login");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/auth/post-auth?intent=login",
    );
  });

  it("redirects authenticated users away from /sign-up", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    const response = await callMiddleware("http://localhost/sign-up");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/auth/post-auth?intent=sign-up",
    );
  });

  it("allows anon user to access the landing page /", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const response = await callMiddleware("http://localhost/");
    expect(response.status).toBe(200);
  });

  it("allows authenticated user to access /dashboard", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    const response = await callMiddleware("http://localhost/dashboard");
    expect(response.status).toBe(200);
  });
});
