import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function loadModule() {
  vi.resetModules();
  return await import("../../../src/lib/auth/redirect-url");
}

describe("auth redirect URL builder", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("buildAuthRedirectUrl returns absolute URL by joining NEXT_PUBLIC_SITE_URL and path", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://talkpik.example.com");
    const { buildAuthRedirectUrl } = await loadModule();

    expect(buildAuthRedirectUrl("/dashboard")).toBe(
      "https://talkpik.example.com/dashboard",
    );
  });

  it("buildAuthRedirectUrl strips trailing slash from site URL before join", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://talkpik.example.com/");
    const { buildAuthRedirectUrl } = await loadModule();

    expect(buildAuthRedirectUrl("/dashboard")).toBe(
      "https://talkpik.example.com/dashboard",
    );
  });

  it("buildAuthRedirectUrl adds leading slash to path if missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://talkpik.example.com");
    const { buildAuthRedirectUrl } = await loadModule();

    expect(buildAuthRedirectUrl("dashboard")).toBe(
      "https://talkpik.example.com/dashboard",
    );
  });

  it("buildAuthRedirectUrl falls back to http://127.0.0.1:3000 in development when SITE_URL missing", async () => {
    vi.stubEnv("NODE_ENV", "development");
    // NEXT_PUBLIC_SITE_URL intentionally not set
    const { buildAuthRedirectUrl } = await loadModule();

    expect(buildAuthRedirectUrl("/onboarding/learning-goal")).toBe(
      "http://127.0.0.1:3000/onboarding/learning-goal",
    );
  });

  it("buildAuthRedirectUrl uses the current local browser origin in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://127.0.0.1:3000");
    vi.stubGlobal("window", {
      location: { origin: "http://localhost:3000" },
    });
    const { buildAuthRedirectUrl } = await loadModule();

    expect(
      buildAuthRedirectUrl("/auth/callback?next=/onboarding/learning-goal"),
    ).toBe(
      "http://localhost:3000/auth/callback?next=/onboarding/learning-goal",
    );
  });

  it("buildAuthRedirectUrl uses the current deployed browser origin to avoid cross-domain auth callbacks", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://talkpik.example.com");
    vi.stubGlobal("window", {
      location: { origin: "https://www.talkpik.example.com" },
    });
    const { buildAuthRedirectUrl } = await loadModule();

    expect(buildAuthRedirectUrl("/auth/callback?next=/dashboard")).toBe(
      "https://www.talkpik.example.com/auth/callback?next=/dashboard",
    );
  });

  it("buildAuthRedirectUrl normalizes 0.0.0.0 browser origins in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://127.0.0.1:3000");
    vi.stubGlobal("window", {
      location: { origin: "http://0.0.0.0:3000" },
    });
    const { buildAuthRedirectUrl } = await loadModule();

    expect(buildAuthRedirectUrl("/auth/callback")).toBe(
      "http://localhost:3000/auth/callback",
    );
  });

  it("buildAuthRedirectUrl throws in production when SITE_URL missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { buildAuthRedirectUrl } = await loadModule();

    expect(() => buildAuthRedirectUrl("/dashboard")).toThrow(
      /NEXT_PUBLIC_SITE_URL/,
    );
  });

  it("buildAuthRedirectUrl rejects non-http(s) site URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "javascript:alert(1)");
    const { buildAuthRedirectUrl } = await loadModule();

    expect(() => buildAuthRedirectUrl("/dashboard")).toThrow();
  });

  it("buildAuthCallbackUrl encodes nested post-auth next query", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://talkpik.example.com");
    const { buildAuthCallbackUrl } = await loadModule();

    expect(buildAuthCallbackUrl("/auth/post-auth?intent=login")).toBe(
      "https://talkpik.example.com/auth/callback?next=%2Fauth%2Fpost-auth%3Fintent%3Dlogin",
    );
  });

  it("buildAuthCallbackUrl rejects absolute next URLs", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://talkpik.example.com");
    const { buildAuthCallbackUrl } = await loadModule();

    expect(() => buildAuthCallbackUrl("https://evil.example")).toThrow(
      /relative/,
    );
  });
});
