/**
 * Single source of truth for sitemap-aligned route data.
 *
 * Keep this file in sync with docs/sitemap.md when a route moves.
 */

export const PUBLIC_PATHS = [
  "/",
  "/sign-up",
  "/login",
  "/password-reset",
  "/password-reset/confirm",
  "/auth/callback",
  "/auth/callback-fragment",
  "/auth/error",
  "/auth/verify-email",
  "/auth/sign-out",
  "/terms",
  "/privacy",
] as const;

export type ProtectedRouteCase = {
  path: string;
  iaCode: string;
};

export const PROTECTED_ROUTE_CASES: readonly ProtectedRouteCase[] = [
  { path: "/auth/post-auth", iaCode: "AUTH-POST" },
  { path: "/auth/consent", iaCode: "AUTH-CONSENT" },
  { path: "/dashboard", iaCode: "B-01" },
  { path: "/growth", iaCode: "X-02" },
  { path: "/library", iaCode: "F-01" },
  { path: "/profile", iaCode: "X-05" },
  { path: "/settings/language", iaCode: "G-01" },
  { path: "/settings/notifications", iaCode: "X-09" },
  { path: "/practice/recommendations", iaCode: "C-01" },
  { path: "/practice/problems", iaCode: "C-02" },
  { path: "/practice/next", iaCode: "R-02" },
  { path: "/practice/weakness", iaCode: "X-07" },
  { path: "/writing/short-answer-writing-51", iaCode: "D-01" },
  { path: "/writing/answer-writing-52", iaCode: "D-02" },
  { path: "/writing/long-form-writing-53", iaCode: "D-03" },
  { path: "/writing/essay-writing-54", iaCode: "D-04" },
  { path: "/writing/feedback/short/abc-id", iaCode: "E-01" },
  { path: "/writing/feedback/long/abc-id", iaCode: "E-02" },
  { path: "/writing/reports/abc-id/compare", iaCode: "R-01" },
  { path: "/onboarding/learning-goal", iaCode: "A-03" },
  { path: "/subscription", iaCode: "X-04" },
  { path: "/paywall", iaCode: "X-03" },
];
