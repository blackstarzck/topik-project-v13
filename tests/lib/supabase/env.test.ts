import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };
const DEV_URL = "https://fglggyfvzjdsbyckinqa.supabase.co";
const PROD_URL = "https://eymlabowhfgtxbiqwxqh.supabase.co";

async function loadEnvModule() {
  vi.resetModules();
  return await import("../../../src/lib/supabase/env");
}

function legacyJwt(role: string): string {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ role })}.signature`;
}

describe("supabase env validation", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.SUPABASE_LOCAL_STACK;
    delete process.env.VERCEL_ENV;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("getPublicEnv returns parsed values when both vars are valid", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = DEV_URL;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_xxxxx";

    const { getPublicEnv } = await loadEnvModule();
    const env = getPublicEnv();

    expect(env.url).toBe(DEV_URL);
    expect(env.publishableKey).toBe("sb_publishable_xxxxx");
  });

  it("accepts a legacy anon JWT when the publishable-key variable is absent", async () => {
    const anonKey = legacyJwt("anon");
    process.env.NEXT_PUBLIC_SUPABASE_URL = DEV_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = anonKey;

    const { getPublicEnv } = await loadEnvModule();

    expect(getPublicEnv().publishableKey).toBe(anonKey);
  });

  it.each([
    "sb_publishable_",
    "sb_secret_browser_slot",
    legacyJwt("service_role"),
    "malformed.jwt",
    "unknown-browser-key",
  ])(
    "rejects an unsafe publishable-key value without echoing it",
    async (value) => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = value;
      const { getPublicEnv } = await loadEnvModule();

      let error: unknown;
      try {
        getPublicEnv();
      } catch (caught) {
        error = caught;
      }

      expect(String(error)).toMatch(/public supabase key is not approved/i);
      expect(String(error)).not.toContain(value);
    },
  );

  it("rejects a secret in the legacy public slot even when the publishable key is safe", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_safe";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "sb_secret_legacy_slot";
    const { getPublicEnv } = await loadEnvModule();

    expect(() => getPublicEnv()).toThrow(
      /public supabase key is not approved/i,
    );
  });

  it("removes a leading BOM and surrounding whitespace from public values", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL =
      `\uFEFF ${DEV_URL} \r\n`;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
      "\uFEFFsb_publishable_xxxxx\r\n";

    const { getPublicEnv } = await loadEnvModule();
    const env = getPublicEnv();

    expect(env.url).toBe(DEV_URL);
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

    expect(() => getPublicEnv()).toThrow(
      /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/,
    );
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

  // Phase 7-A — NODE_ENV-gated localhost HTTP exception.
  // Production / test must still reject http://; only NODE_ENV='development'
  // may use http://127.0.0.1 or http://localhost for local Supabase.
  it("getPublicEnv allows http://127.0.0.1 when NODE_ENV is development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    process.env.SUPABASE_LOCAL_STACK = "1";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_local";

    const { getPublicEnv } = await loadEnvModule();
    const env = getPublicEnv();

    expect(env.url).toBe("http://127.0.0.1:54321");
    expect(env.publishableKey).toBe("sb_publishable_local");
  });

  it("getPublicEnv allows http://localhost when NODE_ENV is development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    process.env.SUPABASE_LOCAL_STACK = "1";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_local";

    const { getPublicEnv } = await loadEnvModule();
    const env = getPublicEnv();

    expect(env.url).toBe("http://localhost:54321");
  });

  it("getPublicEnv allows http://[::1] with a port when NODE_ENV is development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    process.env.SUPABASE_LOCAL_STACK = "1";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://[::1]:54321";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_local";

    const { getPublicEnv } = await loadEnvModule();

    expect(getPublicEnv().url).toBe("http://[::1]:54321");
  });

  it.each([
    "http://localhost.attacker.test:54321",
    "http://localhost@attacker.test:54321",
    "http://127.0.0.1.evil.test:54321",
    "http://127.0.0.1:54321/rest/v1",
    "http://localhost:54321?unsafe=1",
    "http://localhost:54321#unsafe",
  ])("rejects a spoofed or decorated development HTTP URL", async (url) => {
    vi.stubEnv("NODE_ENV", "development");
    process.env.NEXT_PUBLIC_SUPABASE_URL = url;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_local";
    const { getPublicEnv } = await loadEnvModule();

    expect(() => getPublicEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it.each([
    "https://user:password@example.supabase.co",
    "https://@example.supabase.co",
    "https://example.supabase.co/rest/v1",
    "https://example.supabase.co/.",
    "https://example.supabase.co?",
    "https://example.supabase.co?unsafe=1",
    "https://example.supabase.co#",
    "https://example.supabase.co#unsafe",
  ])("rejects a decorated remote HTTPS URL", async (url) => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = url;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_remote";
    const { getPublicEnv } = await loadEnvModule();

    expect(() => getPublicEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("allows an approved remote HTTPS root URL", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = `${DEV_URL}/`;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_remote";
    const { getPublicEnv } = await loadEnvModule();

    expect(getPublicEnv().url).toBe(`${DEV_URL}/`);
  });

  it("getPublicEnv rejects http://127.0.0.1 in production NODE_ENV", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_xxx";

    const { getPublicEnv } = await loadEnvModule();

    expect(() => getPublicEnv()).toThrow(/https/i);
  });

  it("uses only the production project in Vercel Production", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.NEXT_PUBLIC_SUPABASE_URL = PROD_URL;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_prod";
    const { getPublicEnv } = await loadEnvModule();

    expect(getPublicEnv().url).toBe(PROD_URL);

    process.env.NEXT_PUBLIC_SUPABASE_URL = DEV_URL;
    expect(() => getPublicEnv()).toThrow(/runtime supabase target/i);
  });

  it("uses only the development project in Vercel Preview", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.NEXT_PUBLIC_SUPABASE_URL = DEV_URL;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_preview";
    const { getPublicEnv } = await loadEnvModule();

    expect(getPublicEnv().url).toBe(DEV_URL);

    process.env.NEXT_PUBLIC_SUPABASE_URL = PROD_URL;
    expect(() => getPublicEnv()).toThrow(/runtime supabase target/i);
  });

  it.each([PROD_URL, "https://unknown.supabase.co"])(
    "rejects a production or unknown target outside Vercel: %s",
    async (url) => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = url;
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_local";
      const { getPublicEnv } = await loadEnvModule();

      expect(() => getPublicEnv()).toThrow(/runtime supabase target/i);
    },
  );

  it("requires explicit local-stack proof for a loopback target", async () => {
    vi.stubEnv("NODE_ENV", "development");
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_local";
    const { getPublicEnv } = await loadEnvModule();

    expect(() => getPublicEnv()).toThrow(/runtime supabase target/i);

    process.env.SUPABASE_LOCAL_STACK = "1";
    expect(getPublicEnv().url).toBe("http://127.0.0.1:54321");
  });

  it("fails closed for an unknown Vercel environment", async () => {
    process.env.VERCEL_ENV = "staging";
    process.env.NEXT_PUBLIC_SUPABASE_URL = DEV_URL;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_staging";
    const { getPublicEnv } = await loadEnvModule();

    expect(() => getPublicEnv()).toThrow(/runtime supabase target/i);
  });

  it("does not misclassify a server-validated production build in the browser when VERCEL_ENV is unavailable", async () => {
    vi.stubGlobal("window", {});
    process.env.NEXT_PUBLIC_SUPABASE_URL = PROD_URL;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_prod";
    const { getPublicEnv } = await loadEnvModule();

    expect(getPublicEnv().url).toBe(PROD_URL);
  });
});
