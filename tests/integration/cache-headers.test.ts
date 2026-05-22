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

  it("/_next/static/:path* receives Cache-Control immutable for a year", async () => {
    const rules = await nextConfig.headers!();
    const rule = rules.find((r) => r.source === "/_next/static/:path*");
    expect(rule).toBeTruthy();
    const cc = rule!.headers.find((h) => h.key === "Cache-Control");
    expect(cc).toBeTruthy();
    expect(cc!.value).toContain("immutable");
    expect(cc!.value).toContain("max-age=31536000");
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
