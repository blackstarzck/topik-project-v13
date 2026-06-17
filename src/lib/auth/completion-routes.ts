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
export const LEARNING_GOAL_PATH = APP_ROUTES.onboardingLearningGoal;
export const DASHBOARD_PATH = APP_ROUTES.dashboard;

export function getAuthEntryRedirectPath(pathname: string): string {
  return pathname === APP_ROUTES.signUp
    ? POST_AUTH_SIGN_UP_PATH
    : POST_AUTH_LOGIN_PATH;
}
