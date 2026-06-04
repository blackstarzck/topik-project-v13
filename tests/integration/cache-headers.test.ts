import { describe, it, expect } from "vitest";
import nextConfig from "../../next.config";

// Phase 6 P1-6: cache headers are configured via next.config.ts headers()
// (NOT proxy.ts, which excludes static assets via matcher). Codex Round 2
// caught that a catch-all rule would be applied last and override the
// static-asset immutable directive — rev2 plan removes the catch-all.

describe("cache-headers — next.config headers()", () => {
  it("does NOT include a catch-all /:path* rule (Codex Round 2 P1-6)", async () => {
    if (!nextConfig.headers) throw new Error("headers() not defined");
    const rules = await nextConfig.headers();
    const catchAll = rules.find((r) => r.source === "/:path*");
    expect(catchAll).toBeUndefined();
  });

  // The immutable year-long static cache is correct ONLY in production (the
  // build emits content-hashed filenames). In `next dev` the chunk URLs are
  // stable while their content changes on edit, so forcing `immutable` pins a
  // stale chunk and breaks HMR (Next.js warns about this). Hence: prod-only.
  it("applies the immutable year-long static cache in PRODUCTION only", async () => {
    const prev = process.env.NODE_ENV;
    try {
      (process.env as { NODE_ENV?: string }).NODE_ENV = "production";
      const rules = await nextConfig.headers!();
      const rule = rules.find((r) => r.source === "/_next/static/:path*");
      expect(rule, "static immutable rule must exist in production").toBeTruthy();
      const cc = rule!.headers.find((h) => h.key === "Cache-Control");
      expect(cc).toBeTruthy();
      expect(cc!.value).toContain("immutable");
      expect(cc!.value).toContain("max-age=31536000");
    } finally {
      (process.env as { NODE_ENV?: string }).NODE_ENV = prev;
    }
  });

  it("does NOT force-cache /_next/static in development (prevents stale dev chunks)", async () => {
    const prev = process.env.NODE_ENV;
    try {
      (process.env as { NODE_ENV?: string }).NODE_ENV = "development";
      const rules = await nextConfig.headers!();
      const rule = rules.find((r) => r.source === "/_next/static/:path*");
      expect(rule, "static immutable rule must be absent in dev").toBeUndefined();
    } finally {
      (process.env as { NODE_ENV?: string }).NODE_ENV = prev;
    }
  });

  it("/icon.svg and /favicon.ico receive a one-day must-revalidate header", async () => {
    const rules = await nextConfig.headers!();
    for (const path of ["/icon.svg", "/favicon.ico"]) {
      const rule = rules.find((r) => r.source === path);
      expect(rule, `missing rule for ${path}`).toBeTruthy();
      const cc = rule!.headers.find((h) => h.key === "Cache-Control");
      expect(cc!.value).toContain("max-age=86400");
      expect(cc!.value).toContain("must-revalidate");
    }
  });
});
