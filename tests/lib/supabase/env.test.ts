import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

async function loadEnvModule() {
  vi.resetModules();
  return await import("../../../src/lib/supabase/env");
}

describe("supabase env validation", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("getPublicEnv returns parsed values when both vars are valid", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_xxxxx";

    const { getPublicEnv } = await loadEnvModule();
    const env = getPublicEnv();

    expect(env.url).toBe("https://example.supabase.co");
    expect(env.publishableKey).toBe("sb_publishable_xxxxx");
  });

  it("getPublicEnv throws a descriptive error when URL is missing", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_xxxxx";

    const { getPublicEnv } = await loadEnvModule();

    expect(() => getPublicEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("getPublicEnv throws when publishable key is missing", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";

    const { getPublicEnv } = await loadEnvModule();

    expect(() => getPublicEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  });

  it("getPublicEnv rejects a non-HTTPS Supabase URL", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_xxxxx";

    const { getPublicEnv } = await loadEnvModule();

    expect(() => getPublicEnv()).toThrow(/https/i);
  });

  it("getPublicEnv rejects an empty publishable key", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "";

    const { getPublicEnv } = await loadEnvModule();

    expect(() => getPublicEnv()).toThrow();
  });
});
