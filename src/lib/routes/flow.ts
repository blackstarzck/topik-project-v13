import { APP_ROUTES } from "./paths";

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
