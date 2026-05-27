import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function loadModule() {
  vi.resetModules();
  return await import("../../../src/lib/auth/redirect-url");
}

describe("auth redirect URL builder", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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
});
