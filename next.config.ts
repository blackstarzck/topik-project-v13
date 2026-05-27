import type { NextConfig } from "next";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

const nextConfig: NextConfig = {
  // Static-asset cache headers. Phase 6 P1-6:
  // src/proxy.ts middleware matcher EXCLUDES _next/static + asset extensions,
  // so cache headers cannot be set there. Use the framework `headers()` hook
  // instead. Codex Round 2 caught that a catch-all `/:path*` rule would be
  // applied LAST by Next.js and override the static-asset rule, so we
  // intentionally do NOT include a catch-all here — dynamic pages get
  // App Router's default cache behaviour (no-store for RSC).
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: `public, max-age=${ONE_YEAR_SECONDS}, immutable`,
          },
        ],
      },
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
    ];
  },
};

export default nextConfig;
