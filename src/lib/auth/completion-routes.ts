import { APP_ROUTES } from "../routes";

export type AuthCompletionStatus =
  | "anonymous"
  | "pending-consent"
  | "pending-learning-goal"
  | "ready";

// Landing-only recovery state. It is not a product completion state and should
// not be used by workspace guards.
export type LandingAuthStatus = AuthCompletionStatus | "authenticated-recovery";

export const POST_AUTH_LOGIN_PATH = `${APP_ROUTES.authPostAuth}?intent=login`;
export const POST_AUTH_SIGN_UP_PATH = `${APP_ROUTES.authPostAuth}?intent=sign-up`;

// 회원 탈퇴/차단 계정 게이트: 비활성(status<>'active') 세션을 만나면 이 GET
// route handler로 보내 세션 쿠키를 정리한 뒤 /login?reason=... 로 보낸다.
// (서버 컴포넌트 layout 은 쿠키를 못 지우므로 route handler 가 필요하다.)
export const ACCOUNT_INACTIVE_PATH = APP_ROUTES.authAccountInactive;
export const LEARNING_GOAL_PATH = APP_ROUTES.onboardingLearningGoal;
export const DASHBOARD_PATH = APP_ROUTES.dashboard;

export function getAuthEntryRedirectPath(pathname: string): string {
  return pathname === APP_ROUTES.signUp
    ? POST_AUTH_SIGN_UP_PATH
    : POST_AUTH_LOGIN_PATH;
}
