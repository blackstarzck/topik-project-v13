import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// i18n (G-01): user-preference / cookie locale — NO URL routing. The plugin
// only needs to know where the request config lives; locale resolution itself
// happens in src/i18n/request.ts (profiles.ui_locale → NEXT_LOCALE cookie → ko).
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

const nextConfig: NextConfig = {
  // Next 16 blocks cross-origin requests to dev resources (/_next/*) from hosts
  // not in this allowlist. The default allows `localhost` but NOT `127.0.0.1`;
  // the M1 dev-route smoke harness (scripts/dev-route-smoke.mjs) navigates via
  // 127.0.0.1, which got its HMR/dev resources blocked — so client components
  // never hydrated under smoke and client-only behaviour (responsive shell, etc.)
  // appeared "broken" in screenshots though it works for real users on localhost.
  // dev-only setting; has no effect on production.
  allowedDevOrigins: ["127.0.0.1"],
  // Static-asset cache headers. Phase 6 P1-6:
  // src/proxy.ts middleware matcher EXCLUDES _next/static + asset extensions,
  // so cache headers cannot be set there. Use the framework `headers()` hook
  // instead. Codex Round 2 caught that a catch-all `/:path*` rule would be
  // applied LAST by Next.js and override the static-asset rule, so we
  // intentionally do NOT include a catch-all here — dynamic pages get
  // App Router's default cache behaviour (no-store for RSC).
  async headers() {
    const rules = [];
    // `immutable` static caching is correct ONLY in production, where the build
    // emits content-hashed, genuinely-immutable filenames. In `next dev` the
    // chunk URLs are stable but their CONTENT changes on every edit, so
    // `immutable, max-age=1yr` makes the browser pin a STALE chunk for a year and
    // refuse to refetch — that breaks HMR and surfaces phantom "stale chunk"
    // runtime errors (e.g. a console error pointing at code the source no longer
    // contains). Next.js warns about exactly this ("Custom Cache-Control headers
    // detected for /_next/static/:path*"). So apply it in production only.
    if (process.env.NODE_ENV === "production") {
      rules.push({
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: `public, max-age=${ONE_YEAR_SECONDS}, immutable`,
          },
        ],
      });
    }
    rules.push(
      {
        source: "/icon.svg",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, must-revalidate",
          },
        ],
      },
      {
        source: "/favicon.ico",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, must-revalidate",
          },
        ],
      },
    );
    return rules;
  },
};

export default withNextIntl(nextConfig);
