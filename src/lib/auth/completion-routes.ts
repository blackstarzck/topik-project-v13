import { APP_ROUTES } from "../routes";
import { sanitizeNext } from "./error-mapping";

export type AuthCompletionStatus =
  | "anonymous"
  | "pending-auth-completion"
  | "pending-consent"
  | "pending-learning-goal"
  | "ready";

// Landing-only recovery state. It is not a product completion state and should
// not be used by workspace guards.
export type LandingAuthStatus =
  | AuthCompletionStatus
  | "email-unverified"
  | "profile-unavailable"
  | "authenticated-recovery";

export const POST_AUTH_LOGIN_PATH = `${APP_ROUTES.authPostAuth}?intent=login`;
export const POST_AUTH_SIGN_UP_PATH = `${APP_ROUTES.authPostAuth}?intent=sign-up`;

// 회원 탈퇴/차단 계정 게이트: 비활성(status<>'active') 세션을 만나면 이 GET
// route handler로 보내 세션 쿠키를 정리한 뒤 /login?reason=... 로 보낸다.
// (서버 컴포넌트 layout 은 쿠키를 못 지우므로 route handler 가 필요하다.)
export const ACCOUNT_INACTIVE_PATH = APP_ROUTES.authAccountInactive;
export const LEARNING_GOAL_PATH = APP_ROUTES.onboardingLearningGoal;
export const DASHBOARD_PATH = APP_ROUTES.dashboard;

const AUTH_COMPLETION_NEXT_BLOCKED_PATHS = new Set<string>([
  APP_ROUTES.authConsent,
  APP_ROUTES.authCallback,
  APP_ROUTES.login,
  APP_ROUTES.signUp,
  APP_ROUTES.authAccountInactive,
]);

export function getAuthEntryRedirectPath(pathname: string): string {
  return pathname === APP_ROUTES.signUp
    ? POST_AUTH_SIGN_UP_PATH
    : POST_AUTH_LOGIN_PATH;
}

export function sanitizeAuthCompletionNext(
  value: string | null | undefined,
  fallback = POST_AUTH_LOGIN_PATH,
): string {
  const sanitized = sanitizeNext(value, fallback);
  const pathname = sanitized.split(/[?#]/, 1)[0] ?? sanitized;
  if (
    AUTH_COMPLETION_NEXT_BLOCKED_PATHS.has(pathname) ||
    pathname.startsWith(`${APP_ROUTES.authCallback}/`)
  ) {
    return fallback;
  }
  return sanitized;
}
