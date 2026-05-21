/**
 * Single source-of-truth for sitemap-aligned route data.
 *
 * Phase 3 originally hard-coded route paths in three places (SidebarNav,
 * middleware PUBLIC_PATHS, route-matrix test PROTECTED_PATHS) and that
 * drift was flagged in cross-model review. This module exports three
 * narrowly-scoped constants so each consumer reads the shape it needs
 * without re-declaring the path list.
 *
 * Update flow when a route moves: change sitemap.md AND this file together;
 * the consumers do not need to be touched.
 */

// ---------------------------------------------------------------------------
// PUBLIC_PATHS — middleware allowlist
// ---------------------------------------------------------------------------
/**
 * Routes a non-authenticated visitor may reach without redirect.
 * From sitemap.md "Target React Route Map" public set.
 */
export const PUBLIC_PATHS = [
  "/",
  "/sign-up",
  "/login",
  "/password-reset",
] as const;

// ---------------------------------------------------------------------------
// PROTECTED_ROUTE_CASES — test matrix fixtures
// ---------------------------------------------------------------------------
export type ProtectedRouteCase = {
  path: string;
  iaCode: string;
};

/**
 * Every protected route Phase 3 ships as a placeholder. Used by
 * `tests/integration/route-matrix.test.ts` to assert anon→redirect and
 * authenticated→pass-through. Dynamic routes include a sample id so the
 * matcher hits a real path. IA codes track which sitemap row owns the route.
 */
export const PROTECTED_ROUTE_CASES: readonly ProtectedRouteCase[] = [
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
  { path: "/writing/51", iaCode: "D-01" },
  { path: "/writing/52", iaCode: "D-02" },
  { path: "/writing/53", iaCode: "D-03" },
  { path: "/writing/54", iaCode: "D-04" },
  { path: "/writing/feedback/short/abc-id", iaCode: "E-01" },
  { path: "/writing/feedback/long/abc-id", iaCode: "E-02" },
  { path: "/writing/reports/abc-id/compare", iaCode: "R-01" },
  { path: "/admin", iaCode: "admin-index" },
  { path: "/admin/problems", iaCode: "H-01" },
  { path: "/admin/org", iaCode: "X-08" },
  { path: "/admin/users", iaCode: "X-10" },
  { path: "/onboarding/learning-goal", iaCode: "A-03" },
  { path: "/subscription", iaCode: "X-04" },
  { path: "/paywall", iaCode: "X-03" },
];

// ---------------------------------------------------------------------------
// SIDEBAR_ITEMS / SIDEBAR_ADMIN_SECTION — SidebarNav menu structure
// ---------------------------------------------------------------------------
export type SidebarLeaf = { key: string; label: string };
export type SidebarGroup = {
  key: string;
  label: string;
  children: SidebarLeaf[];
};
export type SidebarItem = SidebarLeaf | SidebarGroup;

/**
 * Default sidebar (visible to learners and admins alike). Keys that start
 * with `/` are click-navigable; group keys are non-path identifiers.
 */
export const SIDEBAR_ITEMS: readonly SidebarItem[] = [
  { key: "/dashboard", label: "대시보드" },
  {
    key: "practice",
    label: "학습",
    children: [
      { key: "/practice/recommendations", label: "추천" },
      { key: "/practice/problems", label: "문제 풀이" },
      { key: "/practice/next", label: "다음 문제" },
      { key: "/practice/weakness", label: "약점 보강" },
    ],
  },
  {
    key: "writing",
    label: "글쓰기",
    children: [
      { key: "/writing/51", label: "51 단답" },
      { key: "/writing/52", label: "52 답변" },
      { key: "/writing/53", label: "53 장문" },
      { key: "/writing/54", label: "54 에세이" },
    ],
  },
  { key: "/library", label: "내 라이브러리" },
  { key: "/growth", label: "성장 대시보드" },
  { key: "/profile", label: "프로필" },
  {
    key: "settings",
    label: "설정",
    children: [
      { key: "/settings/language", label: "언어" },
      { key: "/settings/notifications", label: "알림" },
    ],
  },
];

/**
 * Admin-only section. SidebarNav appends this when the current user's role
 * is in `ADMIN_ROLES` (see `src/lib/auth/roles.ts`).
 */
export const SIDEBAR_ADMIN_SECTION: SidebarGroup = {
  key: "admin",
  label: "관리",
  children: [
    { key: "/admin/problems", label: "문제 관리" },
    { key: "/admin/org", label: "기관 관리" },
    { key: "/admin/users", label: "사용자 관리" },
  ],
};
