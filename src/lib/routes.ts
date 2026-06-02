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

import type { AppRole } from "./auth/roles";

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
  "/password-reset/confirm",
  // Phase 8-D auth callback/error/verify-email — Codex Round 1 NF3.
  // Without these, anonymous callback redirects to /login and the token
  // exchange itself never runs, breaking the entire confirmation flow.
  "/auth/callback",
  "/auth/callback-fragment", // Phase 8 follow-up P0 (2026-05-27): implicit flow fragment fallback page
  "/auth/error",
  "/auth/verify-email",
  // Sign-out must be reachable without an active session — anonymous POST is
  // idempotent (already signed out) and authenticated POST is the canonical
  // logout path. Without this entry middleware redirects /auth/sign-out to
  // /login, which (1) breaks the POST contract and (2) creates a paradox
  // because the post-signout user is anonymous and would loop.
  "/auth/sign-out",
  // Codex P4 D4 (2026-05-29): /sign-up 체크박스에서 동의 대상으로 anchor 링크.
  // 동의 강제는 받지만 정책 페이지를 anonymous 가 못 보면 dark-pattern. legal
  // placeholder 페이지이지만 reachable 해야 함.
  "/terms",
  "/privacy",
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
  { path: "/admin", iaCode: "X-15" },
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

// ---------------------------------------------------------------------------
// Sidebar lock gating — B-01 area 1 예외
// ---------------------------------------------------------------------------
/**
 * B-01 area 1 예외: "권한 잠금 메뉴는 비활성 스타일과 잠금 사유 표시."
 *
 * 일부 학습자 메뉴는 플랜/권한 조건이 충족돼야 의미가 있다. 숨기거나(hidden)
 * 그냥 활성화(active)하는 대신, 조건 미달이면 **비활성(disabled) + 잠금 사유**
 * 로 노출해야 한다는 것이 스펙 계약이다.
 *
 * 이 모듈은 잠금 *대상*과 *사유*만 데이터로 선언한다. 실제 disabled 렌더링은
 * `SidebarNav`(client) 가 담당한다. 색상만으로 의미를 전달하지 않도록 사유는
 * 항상 텍스트(`reason`)로 제공한다(접근성 — IA security/data 룰).
 *
 * 무료 플랜에서 잠기는 메뉴:
 * - `/growth` 성장 대시보드 — 상세 리포트가 유료 전용(X-02 area 1 예외와 정합).
 *   메뉴 자체는 reachable 하되, 무료 사용자에게는 "유료 전용" 사유를 보여 준다.
 */
export const PAID_PLAN_LABELS: ReadonlySet<string> = new Set([
  "premium",
  "pro",
  "team",
  "yearly",
  "quarterly",
  "monthly",
]);

export function isPaidPlan(planLabel: string | null | undefined): boolean {
  if (!planLabel) return false;
  return PAID_PLAN_LABELS.has(planLabel.toLowerCase());
}

/** 잠금 사유를 키별로 매핑. 비어 있으면 해당 메뉴는 잠겨 있지 않다. */
export type SidebarLockMap = Readonly<Record<string, string>>;

/**
 * 현재 사용자(role/plan)에게 잠겨야 하는 사이드바 leaf 키 → 사유 매핑을 만든다.
 * `SidebarNav` 는 이 맵을 읽어 해당 leaf 를 disabled + 사유로 렌더한다.
 */
export function computeSidebarLocks(args: {
  role: AppRole;
  planLabel: string | null | undefined;
}): SidebarLockMap {
  const locks: Record<string, string> = {};
  // 무료 플랜: 성장 대시보드 상세 리포트는 유료 전용(X-02). 메뉴는 보이되 잠금.
  if (!isPaidPlan(args.planLabel)) {
    locks["/growth"] = "유료 플랜 전용";
  }
  return locks;
}
