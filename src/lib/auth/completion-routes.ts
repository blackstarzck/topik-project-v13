export type AuthCompletionStatus =
  | "anonymous"
  | "pending-consent"
  | "pending-learning-goal"
  | "ready";

// Landing-only recovery state. It is not a product completion state and should
// not be used by workspace guards.
export type LandingAuthStatus = AuthCompletionStatus | "authenticated-recovery";

export const POST_AUTH_LOGIN_PATH = "/auth/post-auth?intent=login";
export const POST_AUTH_SIGN_UP_PATH = "/auth/post-auth?intent=sign-up";
export const LEARNING_GOAL_PATH = "/onboarding/learning-goal";
export const DASHBOARD_PATH = "/dashboard";

export function getAuthEntryRedirectPath(pathname: string): string {
  return pathname === "/sign-up" ? POST_AUTH_SIGN_UP_PATH : POST_AUTH_LOGIN_PATH;
}
