/**
 * Single source of truth for sitemap-aligned route data.
 *
 * Keep this file in sync with docs/flow/user-flow.md and
 * docs/flow/sitemap.md when a route moves.
 */

import type { AppRole } from "./auth/roles";

export const APP_ROUTES = {
  landing: "/",
  signUp: "/sign-up",
  login: "/login",
  passwordReset: "/password-reset",
  passwordResetConfirm: "/password-reset/confirm",
  authCallback: "/auth/callback",
  authCallbackFragment: "/auth/callback-fragment",
  authClaimAffiliation: "/auth/claim-affiliation",
  authError: "/auth/error",
  authVerifyEmail: "/auth/verify-email",
  authPostAuth: "/auth/post-auth",
  authConsent: "/auth/consent",
  authSignOut: "/auth/sign-out",
  terms: "/terms",
  privacy: "/privacy",
  onboardingLearningGoal: "/onboarding/learning-goal",
  dashboard: "/dashboard",
  practiceRecommendations: "/practice/recommendations",
  practiceProblems: "/practice/problems",
  practiceNext: "/practice/next",
  practiceWeakness: "/practice/weakness",
  writing51: "/writing/short-answer-writing-51",
  writing52: "/writing/answer-writing-52",
  writing53: "/writing/long-form-writing-53",
  writing54: "/writing/essay-writing-54",
  feedbackShort: "/writing/feedback/short/:id",
  feedbackLong: "/writing/feedback/long/:id",
  comparisonReport: "/writing/reports/:id/compare",
  library: "/library",
  growth: "/growth",
  paywall: "/paywall",
  subscription: "/subscription",
  profile: "/profile",
  settingsLearning: "/settings/learning",
  settingsAccount: "/settings/account",
  settingsLanguage: "/settings/language",
  settingsNotifications: "/settings/notifications",
  apiExportPdf: "/api/export/pdf",
  apiNotificationsDispatchEmail: "/api/notifications/dispatch-email",
  apiNotificationsUnsubscribe: "/api/notifications/unsubscribe",
} as const;

export const WRITING_ROUTE_SEGMENTS_BY_QUESTION = {
  51: "short-answer-writing-51",
  52: "answer-writing-52",
  53: "long-form-writing-53",
  54: "essay-writing-54",
} as const;

export const WRITING_ROUTE_PATHS_BY_QUESTION = {
  51: APP_ROUTES.writing51,
  52: APP_ROUTES.writing52,
  53: APP_ROUTES.writing53,
  54: APP_ROUTES.writing54,
} as const;

export type FlowRouteType =
  | "page"
  | "page + server action"
  | "modal"
  | "modal/state";

export type FlowRouteSpec = {
  id: string;
  iaCode: string;
  title: string;
  path: string;
  pathPattern?: string;
  routeType: FlowRouteType;
  hostPaths?: readonly string[];
};

const WRITING_HOST_PATHS = [
  APP_ROUTES.writing51,
  APP_ROUTES.writing52,
  APP_ROUTES.writing53,
  APP_ROUTES.writing54,
] as const;

export const FLOW_ROUTE_SPECS: readonly FlowRouteSpec[] = [
  {
    id: "sign-up",
    iaCode: "A-01",
    title: "회원가입",
    path: APP_ROUTES.signUp,
    routeType: "page",
  },
  {
    id: "login",
    iaCode: "A-02",
    title: "로그인",
    path: APP_ROUTES.login,
    routeType: "page",
  },
  {
    id: "learning-goal",
    iaCode: "A-03",
    title: "학습 목표 설정",
    path: APP_ROUTES.onboardingLearningGoal,
    routeType: "page",
  },
  {
    id: "dashboard",
    iaCode: "B-01",
    title: "홈 대시보드",
    path: APP_ROUTES.dashboard,
    routeType: "page",
  },
  {
    id: "practice-recommendations",
    iaCode: "C-01",
    title: "문제 유형 추천",
    path: APP_ROUTES.practiceRecommendations,
    routeType: "page",
  },
  {
    id: "practice-problems",
    iaCode: "C-02",
    title: "문제 목록",
    path: APP_ROUTES.practiceProblems,
    routeType: "page",
  },
  {
    id: "retry-modal",
    iaCode: "C-03",
    title: "다시 풀기 모달",
    path: APP_ROUTES.practiceProblems,
    routeType: "modal",
    hostPaths: [APP_ROUTES.practiceProblems],
  },
  {
    id: "writing-51",
    iaCode: "D-01",
    title: "51번 단답 작성",
    path: APP_ROUTES.writing51,
    routeType: "page",
  },
  {
    id: "writing-52",
    iaCode: "D-02",
    title: "52번 답안 작성",
    path: APP_ROUTES.writing52,
    routeType: "page",
  },
  {
    id: "writing-53",
    iaCode: "D-03",
    title: "53번 장문 작성",
    path: APP_ROUTES.writing53,
    routeType: "page",
  },
  {
    id: "writing-54",
    iaCode: "D-04",
    title: "54번 에세이 작성",
    path: APP_ROUTES.writing54,
    routeType: "page",
  },
  {
    id: "submission-confirmation-modal",
    iaCode: "D-M1",
    title: "제출 확인 모달",
    path: WRITING_HOST_PATHS.join(", "),
    routeType: "modal",
    hostPaths: WRITING_HOST_PATHS,
  },
  {
    id: "analysis-loading",
    iaCode: "D-M2",
    title: "AI 분석 로딩",
    path: "writing submission flow",
    routeType: "modal/state",
  },
  {
    id: "autosave-warning",
    iaCode: "D-M3",
    title: "자동저장 경고",
    path: WRITING_HOST_PATHS.join(", "),
    routeType: "modal",
    hostPaths: WRITING_HOST_PATHS,
  },
  {
    id: "feedback-short",
    iaCode: "E-01",
    title: "단답 피드백",
    path: APP_ROUTES.feedbackShort,
    pathPattern: APP_ROUTES.feedbackShort,
    routeType: "page",
  },
  {
    id: "feedback-long",
    iaCode: "E-02",
    title: "장문 피드백",
    path: APP_ROUTES.feedbackLong,
    pathPattern: APP_ROUTES.feedbackLong,
    routeType: "page",
  },
  {
    id: "library",
    iaCode: "F-01",
    title: "내 서재",
    path: APP_ROUTES.library,
    routeType: "page",
  },
  {
    id: "pdf-export-modal",
    iaCode: "F-M1",
    title: "PDF 내보내기 모달",
    path: `${APP_ROUTES.library}, ${APP_ROUTES.feedbackShort}, ${APP_ROUTES.feedbackLong}, ${APP_ROUTES.comparisonReport}`,
    routeType: "modal",
    hostPaths: [
      APP_ROUTES.library,
      APP_ROUTES.feedbackShort,
      APP_ROUTES.feedbackLong,
      APP_ROUTES.comparisonReport,
    ],
  },
  {
    id: "settings-language",
    iaCode: "G-01",
    title: "설정 언어",
    path: APP_ROUTES.settingsLanguage,
    routeType: "page",
  },
  {
    id: "comparison-report",
    iaCode: "R-01",
    title: "비교 리포트",
    path: APP_ROUTES.comparisonReport,
    pathPattern: APP_ROUTES.comparisonReport,
    routeType: "page",
  },
  {
    id: "practice-next",
    iaCode: "R-02",
    title: "다음 문제 추천",
    path: APP_ROUTES.practiceNext,
    routeType: "page",
  },
  {
    id: "landing",
    iaCode: "X-01",
    title: "제품 랜딩",
    path: APP_ROUTES.landing,
    routeType: "page",
  },
  {
    id: "growth",
    iaCode: "X-02",
    title: "성장 대시보드",
    path: APP_ROUTES.growth,
    routeType: "page",
  },
  {
    id: "paywall",
    iaCode: "X-03",
    title: "페이월",
    path: APP_ROUTES.paywall,
    routeType: "page",
  },
  {
    id: "subscription",
    iaCode: "X-04",
    title: "구독 관리",
    path: APP_ROUTES.subscription,
    routeType: "page",
  },
  {
    id: "profile",
    iaCode: "X-05",
    title: "프로필 편집",
    path: APP_ROUTES.profile,
    routeType: "page",
  },
  {
    id: "password-reset",
    iaCode: "X-06",
    title: "비밀번호 재설정",
    path: APP_ROUTES.passwordReset,
    routeType: "page",
  },
  {
    id: "practice-weakness",
    iaCode: "X-07",
    title: "약점 기반 추천",
    path: APP_ROUTES.practiceWeakness,
    routeType: "page",
  },
  {
    id: "settings-notifications",
    iaCode: "X-09",
    title: "알림 설정",
    path: APP_ROUTES.settingsNotifications,
    routeType: "page",
  },
  {
    id: "auth-error",
    iaCode: "X-11",
    title: "인증 에러",
    path: APP_ROUTES.authError,
    routeType: "page",
  },
  {
    id: "auth-verify-email",
    iaCode: "X-12",
    title: "인증 메일 확인 안내",
    path: APP_ROUTES.authVerifyEmail,
    routeType: "page",
  },
  {
    id: "terms",
    iaCode: "X-13",
    title: "이용약관",
    path: APP_ROUTES.terms,
    routeType: "page",
  },
  {
    id: "privacy",
    iaCode: "X-14",
    title: "개인정보처리방침",
    path: APP_ROUTES.privacy,
    routeType: "page",
  },
  {
    id: "password-reset-confirm",
    iaCode: "X-16",
    title: "새 비밀번호 설정",
    path: APP_ROUTES.passwordResetConfirm,
    routeType: "page",
  },
  {
    id: "auth-callback-fragment",
    iaCode: "X-17",
    title: "인증 콜백 fragment 처리",
    path: APP_ROUTES.authCallbackFragment,
    routeType: "page",
  },
  {
    id: "auth-consent",
    iaCode: "X-18",
    title: "소셜 로그인 약관 동의",
    path: APP_ROUTES.authConsent,
    routeType: "page + server action",
  },
] as const;

export type RouteMiddleware = "public" | "protected" | "excluded";
export type AppRouteType =
  | "page"
  | "system-page"
  | "route-handler"
  | "api-route";

export type AppRouteSpec = {
  id: string;
  iaCode: string;
  title: string;
  path: string;
  pathPattern?: string;
  samplePath?: string;
  appPath: string;
  routeType: AppRouteType;
  middleware: RouteMiddleware;
};

export const APP_ROUTE_SPECS: readonly AppRouteSpec[] = [
  {
    id: "landing",
    iaCode: "X-01",
    title: "제품 랜딩",
    path: APP_ROUTES.landing,
    appPath: "src/app/page.tsx",
    routeType: "page",
    middleware: "public",
  },
  {
    id: "sign-up",
    iaCode: "A-01",
    title: "회원가입",
    path: APP_ROUTES.signUp,
    appPath: "src/app/sign-up/page.tsx",
    routeType: "page",
    middleware: "public",
  },
  {
    id: "login",
    iaCode: "A-02",
    title: "로그인",
    path: APP_ROUTES.login,
    appPath: "src/app/login/page.tsx",
    routeType: "page",
    middleware: "public",
  },
  {
    id: "password-reset",
    iaCode: "X-06",
    title: "비밀번호 재설정",
    path: APP_ROUTES.passwordReset,
    appPath: "src/app/password-reset/page.tsx",
    routeType: "page",
    middleware: "public",
  },
  {
    id: "password-reset-confirm",
    iaCode: "X-16",
    title: "새 비밀번호 설정",
    path: APP_ROUTES.passwordResetConfirm,
    appPath: "src/app/password-reset/confirm/page.tsx",
    routeType: "page",
    middleware: "public",
  },
  {
    id: "auth-callback",
    iaCode: "AUTH-CALLBACK",
    title: "인증 콜백 라우트 핸들러",
    path: APP_ROUTES.authCallback,
    appPath: "src/app/auth/callback/route.ts",
    routeType: "route-handler",
    middleware: "public",
  },
  {
    id: "auth-callback-fragment",
    iaCode: "X-17",
    title: "인증 콜백 fragment 처리",
    path: APP_ROUTES.authCallbackFragment,
    appPath: "src/app/auth/callback-fragment/page.tsx",
    routeType: "page",
    middleware: "public",
  },
  {
    id: "auth-error",
    iaCode: "X-11",
    title: "인증 에러",
    path: APP_ROUTES.authError,
    appPath: "src/app/auth/error/page.tsx",
    routeType: "page",
    middleware: "public",
  },
  {
    id: "auth-verify-email",
    iaCode: "X-12",
    title: "인증 메일 확인 안내",
    path: APP_ROUTES.authVerifyEmail,
    appPath: "src/app/auth/verify-email/page.tsx",
    routeType: "page",
    middleware: "public",
  },
  {
    id: "auth-claim-affiliation",
    iaCode: "AUTH-CLAIM-AFFILIATION",
    title: "기관 회원 유입 코드 claim",
    path: APP_ROUTES.authClaimAffiliation,
    appPath: "src/app/auth/claim-affiliation/page.tsx",
    routeType: "system-page",
    middleware: "protected",
  },
  {
    id: "auth-sign-out",
    iaCode: "AUTH-SIGN-OUT",
    title: "로그아웃 라우트 핸들러",
    path: APP_ROUTES.authSignOut,
    appPath: "src/app/auth/sign-out/route.ts",
    routeType: "route-handler",
    middleware: "public",
  },
  {
    id: "terms",
    iaCode: "X-13",
    title: "이용약관",
    path: APP_ROUTES.terms,
    appPath: "src/app/terms/page.tsx",
    routeType: "page",
    middleware: "public",
  },
  {
    id: "privacy",
    iaCode: "X-14",
    title: "개인정보처리방침",
    path: APP_ROUTES.privacy,
    appPath: "src/app/privacy/page.tsx",
    routeType: "page",
    middleware: "public",
  },
  {
    id: "auth-post-auth",
    iaCode: "AUTH-POST",
    title: "OAuth 후처리",
    path: APP_ROUTES.authPostAuth,
    appPath: "src/app/auth/post-auth/page.tsx",
    routeType: "system-page",
    middleware: "protected",
  },
  {
    id: "auth-consent",
    iaCode: "X-18",
    title: "소셜 로그인 약관 동의",
    path: APP_ROUTES.authConsent,
    appPath: "src/app/auth/consent/page.tsx",
    routeType: "page",
    middleware: "protected",
  },
  {
    id: "dashboard",
    iaCode: "B-01",
    title: "홈 대시보드",
    path: APP_ROUTES.dashboard,
    appPath: "src/app/(workspace)/dashboard/page.tsx",
    routeType: "page",
    middleware: "protected",
  },
  {
    id: "growth",
    iaCode: "X-02",
    title: "성장 대시보드",
    path: APP_ROUTES.growth,
    appPath: "src/app/(workspace)/growth/page.tsx",
    routeType: "page",
    middleware: "protected",
  },
  {
    id: "library",
    iaCode: "F-01",
    title: "내 서재",
    path: APP_ROUTES.library,
    appPath: "src/app/(workspace)/library/page.tsx",
    routeType: "page",
    middleware: "protected",
  },
  {
    id: "profile",
    iaCode: "X-05",
    title: "프로필 편집",
    path: APP_ROUTES.profile,
    appPath: "src/app/(workspace)/profile/page.tsx",
    routeType: "page",
    middleware: "protected",
  },
  {
    id: "settings-learning",
    iaCode: "SETTINGS-LEARNING",
    title: "Learning goal settings",
    path: APP_ROUTES.settingsLearning,
    appPath: "src/app/(workspace)/settings/learning/page.tsx",
    routeType: "page",
    middleware: "protected",
  },
  {
    id: "settings-account",
    iaCode: "SETTINGS-ACCOUNT",
    title: "Account settings",
    path: APP_ROUTES.settingsAccount,
    appPath: "src/app/(workspace)/settings/account/page.tsx",
    routeType: "page",
    middleware: "protected",
  },
  {
    id: "settings-language",
    iaCode: "G-01",
    title: "설정 언어",
    path: APP_ROUTES.settingsLanguage,
    appPath: "src/app/(workspace)/settings/language/page.tsx",
    routeType: "page",
    middleware: "protected",
  },
  {
    id: "settings-notifications",
    iaCode: "X-09",
    title: "알림 설정",
    path: APP_ROUTES.settingsNotifications,
    appPath: "src/app/(workspace)/settings/notifications/page.tsx",
    routeType: "page",
    middleware: "protected",
  },
  {
    id: "practice-recommendations",
    iaCode: "C-01",
    title: "문제 유형 추천",
    path: APP_ROUTES.practiceRecommendations,
    appPath: "src/app/(workspace)/practice/recommendations/page.tsx",
    routeType: "page",
    middleware: "protected",
  },
  {
    id: "practice-problems",
    iaCode: "C-02",
    title: "문제 목록",
    path: APP_ROUTES.practiceProblems,
    appPath: "src/app/(workspace)/practice/problems/page.tsx",
    routeType: "page",
    middleware: "protected",
  },
  {
    id: "practice-next",
    iaCode: "R-02",
    title: "다음 문제 추천",
    path: APP_ROUTES.practiceNext,
    appPath: "src/app/(workspace)/practice/next/page.tsx",
    routeType: "page",
    middleware: "protected",
  },
  {
    id: "practice-weakness",
    iaCode: "X-07",
    title: "약점 기반 추천",
    path: APP_ROUTES.practiceWeakness,
    appPath: "src/app/(workspace)/practice/weakness/page.tsx",
    routeType: "page",
    middleware: "protected",
  },
  {
    id: "writing-51",
    iaCode: "D-01",
    title: "51번 단답 작성",
    path: APP_ROUTES.writing51,
    appPath: "src/app/(workspace)/writing/short-answer-writing-51/page.tsx",
    routeType: "page",
    middleware: "protected",
  },
  {
    id: "writing-52",
    iaCode: "D-02",
    title: "52번 답안 작성",
    path: APP_ROUTES.writing52,
    appPath: "src/app/(workspace)/writing/answer-writing-52/page.tsx",
    routeType: "page",
    middleware: "protected",
  },
  {
    id: "writing-53",
    iaCode: "D-03",
    title: "53번 장문 작성",
    path: APP_ROUTES.writing53,
    appPath: "src/app/(workspace)/writing/long-form-writing-53/page.tsx",
    routeType: "page",
    middleware: "protected",
  },
  {
    id: "writing-54",
    iaCode: "D-04",
    title: "54번 에세이 작성",
    path: APP_ROUTES.writing54,
    appPath: "src/app/(workspace)/writing/essay-writing-54/page.tsx",
    routeType: "page",
    middleware: "protected",
  },
  {
    id: "feedback-short",
    iaCode: "E-01",
    title: "단답 피드백",
    path: APP_ROUTES.feedbackShort,
    pathPattern: APP_ROUTES.feedbackShort,
    samplePath: "/writing/feedback/short/abc-id",
    appPath: "src/app/(workspace)/writing/feedback/short/[id]/page.tsx",
    routeType: "page",
    middleware: "protected",
  },
  {
    id: "feedback-long",
    iaCode: "E-02",
    title: "장문 피드백",
    path: APP_ROUTES.feedbackLong,
    pathPattern: APP_ROUTES.feedbackLong,
    samplePath: "/writing/feedback/long/abc-id",
    appPath: "src/app/(workspace)/writing/feedback/long/[id]/page.tsx",
    routeType: "page",
    middleware: "protected",
  },
  {
    id: "comparison-report",
    iaCode: "R-01",
    title: "비교 리포트",
    path: APP_ROUTES.comparisonReport,
    pathPattern: APP_ROUTES.comparisonReport,
    samplePath: "/writing/reports/abc-id/compare",
    appPath: "src/app/(workspace)/writing/reports/[id]/compare/page.tsx",
    routeType: "page",
    middleware: "protected",
  },
  {
    id: "learning-goal",
    iaCode: "A-03",
    title: "학습 목표 설정",
    path: APP_ROUTES.onboardingLearningGoal,
    appPath: "src/app/(workspace)/onboarding/learning-goal/page.tsx",
    routeType: "page",
    middleware: "protected",
  },
  {
    id: "subscription",
    iaCode: "X-04",
    title: "구독 관리",
    path: APP_ROUTES.subscription,
    appPath: "src/app/(workspace)/subscription/page.tsx",
    routeType: "page",
    middleware: "protected",
  },
  {
    id: "paywall",
    iaCode: "X-03",
    title: "페이월",
    path: APP_ROUTES.paywall,
    appPath: "src/app/(workspace)/paywall/page.tsx",
    routeType: "page",
    middleware: "protected",
  },
  {
    id: "api-export-pdf",
    iaCode: "API-EXPORT-PDF",
    title: "PDF 내보내기 API",
    path: APP_ROUTES.apiExportPdf,
    appPath: "src/app/api/export/pdf/route.ts",
    routeType: "api-route",
    middleware: "excluded",
  },
  {
    id: "api-notifications-dispatch-email",
    iaCode: "API-NOTIFICATIONS-DISPATCH-EMAIL",
    title: "알림 이메일 발송 API",
    path: APP_ROUTES.apiNotificationsDispatchEmail,
    appPath: "src/app/api/notifications/dispatch-email/route.ts",
    routeType: "api-route",
    middleware: "excluded",
  },
  {
    id: "api-notifications-unsubscribe",
    iaCode: "API-NOTIFICATIONS-UNSUBSCRIBE",
    title: "알림 수신거부 API",
    path: APP_ROUTES.apiNotificationsUnsubscribe,
    appPath: "src/app/api/notifications/unsubscribe/route.ts",
    routeType: "api-route",
    middleware: "excluded",
  },
] as const;

export const PUBLIC_PATHS = APP_ROUTE_SPECS.filter(
  (route) => route.middleware === "public",
).map((route) => route.path);

export const AUTH_ENTRY_PATHS = [APP_ROUTES.login, APP_ROUTES.signUp] as const;

export type ProtectedRouteCase = {
  path: string;
  iaCode: string;
};

export const PROTECTED_ROUTE_CASES: readonly ProtectedRouteCase[] =
  APP_ROUTE_SPECS.filter((route) => route.middleware === "protected").map(
    (route) => ({
      path: route.samplePath ?? route.path,
      iaCode: route.iaCode,
    }),
  );

export type SidebarLeaf = { key: string; label: string; labelKey: string };
export type SidebarGroup = {
  key: string;
  label: string;
  labelKey: string;
  children: SidebarLeaf[];
};
export type SidebarItem = SidebarLeaf | SidebarGroup;

export const SIDEBAR_ITEMS: readonly SidebarItem[] = [
  { key: APP_ROUTES.dashboard, label: "Dashboard", labelKey: "dashboard" },
  {
    key: "practice",
    label: "Practice",
    labelKey: "practice",
    children: [
      {
        key: APP_ROUTES.practiceRecommendations,
        label: "Recommendations",
        labelKey: "practiceRecommendations",
      },
      {
        key: APP_ROUTES.practiceProblems,
        label: "Problems",
        labelKey: "practiceProblems",
      },
    ],
  },
  {
    key: "writing",
    label: "Writing",
    labelKey: "writing",
    children: [
      {
        key: APP_ROUTES.writing51,
        label: "Writing 51",
        labelKey: "writing51",
      },
      {
        key: APP_ROUTES.writing52,
        label: "Writing 52",
        labelKey: "writing52",
      },
      {
        key: APP_ROUTES.writing53,
        label: "Writing 53",
        labelKey: "writing53",
      },
      {
        key: APP_ROUTES.writing54,
        label: "Writing 54",
        labelKey: "writing54",
      },
    ],
  },
  { key: APP_ROUTES.library, label: "Library", labelKey: "library" },
  {
    key: "growth",
    label: "Growth",
    labelKey: "growth",
    children: [
      {
        key: APP_ROUTES.growth,
        label: "Growth dashboard",
        labelKey: "growthDashboard",
      },
      {
        key: APP_ROUTES.practiceWeakness,
        label: "Weakness",
        labelKey: "practiceWeakness",
      },
    ],
  },
  {
    key: "settings",
    label: "Settings",
    labelKey: "settings",
    children: [
      {
        key: APP_ROUTES.profile,
        label: "Profile",
        labelKey: "profile",
      },
      {
        key: APP_ROUTES.settingsLearning,
        label: "Learning goal",
        labelKey: "settingsLearning",
      },
      {
        key: APP_ROUTES.settingsAccount,
        label: "Account",
        labelKey: "settingsAccount",
      },
      {
        key: APP_ROUTES.settingsLanguage,
        label: "Language",
        labelKey: "settingsLanguage",
      },
      {
        key: APP_ROUTES.settingsNotifications,
        label: "Notifications",
        labelKey: "settingsNotifications",
      },
      // 구독 관리(X-04)는 사이드바 직접 메뉴에서 숨긴다. route 자체는 유지하며
      // 페이월(X-03) CTA 흐름에서만 진입한다(SHARE-03 contextual-only 옵션).
    ],
  },
];

export type SidebarLockMap = Readonly<Record<string, string>>;

export function computeSidebarLocks(args: {
  role: AppRole;
  planLabel: string | null | undefined;
}): SidebarLockMap {
  void args;
  return {};
}
