import type { LandingAuthStatus } from "@/lib/auth/completion-routes";
import {
  DASHBOARD_PATH,
  LEARNING_GOAL_PATH,
  POST_AUTH_LOGIN_PATH,
} from "@/lib/auth/completion-routes";
import { APP_ROUTES } from "@/lib/routes";

export type AuthenticatedLandingStatus = Exclude<
  LandingAuthStatus,
  "anonymous"
>;

export type LandingCta = {
  href: string;
  headerLabelKey:
    | "ctaAuthCompletion"
    | "ctaConsentContinue"
    | "ctaLearningGoal"
    | "ctaDashboard"
    | "ctaRetry"
    | "ctaContinueSetup";
  heroLabelKey:
    | "heroCtaAuthCompletion"
    | "heroCtaConsentContinue"
    | "heroCtaLearningGoal"
    | "heroCtaDashboard"
    | "heroCtaRetry"
    | "heroCtaContinueSetup";
};

export function getLandingCta(status: AuthenticatedLandingStatus): LandingCta {
  switch (status) {
    case "pending-auth-completion":
      return {
        href: POST_AUTH_LOGIN_PATH,
        headerLabelKey: "ctaAuthCompletion",
        heroLabelKey: "heroCtaAuthCompletion",
      };
    case "pending-consent":
      return {
        href: POST_AUTH_LOGIN_PATH,
        headerLabelKey: "ctaConsentContinue",
        heroLabelKey: "heroCtaConsentContinue",
      };
    case "pending-learning-goal":
      return {
        href: LEARNING_GOAL_PATH,
        headerLabelKey: "ctaLearningGoal",
        heroLabelKey: "heroCtaLearningGoal",
      };
    case "ready":
      return {
        href: DASHBOARD_PATH,
        headerLabelKey: "ctaDashboard",
        heroLabelKey: "heroCtaDashboard",
      };
    case "email-unverified":
      return {
        href: APP_ROUTES.authVerifyEmail,
        headerLabelKey: "ctaContinueSetup",
        heroLabelKey: "heroCtaContinueSetup",
      };
    case "authenticated-recovery":
    case "profile-unavailable":
      return {
        href: "/",
        headerLabelKey: "ctaRetry",
        heroLabelKey: "heroCtaRetry",
      };
  }
}
