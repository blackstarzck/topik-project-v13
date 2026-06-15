import type { LandingAuthStatus } from "@/lib/auth/completion-routes";
import {
  DASHBOARD_PATH,
  LEARNING_GOAL_PATH,
  POST_AUTH_LOGIN_PATH,
} from "@/lib/auth/completion-routes";

export type AuthenticatedLandingStatus = Exclude<
  LandingAuthStatus,
  "anonymous"
>;

export type LandingCta = {
  href: string;
  headerLabelKey:
    | "ctaConsentContinue"
    | "ctaLearningGoal"
    | "ctaDashboard"
    | "ctaContinueSetup";
  heroLabelKey:
    | "heroCtaConsentContinue"
    | "heroCtaLearningGoal"
    | "heroCtaDashboard"
    | "heroCtaContinueSetup";
};

export function getLandingCta(status: AuthenticatedLandingStatus): LandingCta {
  switch (status) {
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
    case "authenticated-recovery":
      return {
        href: POST_AUTH_LOGIN_PATH,
        headerLabelKey: "ctaContinueSetup",
        heroLabelKey: "heroCtaContinueSetup",
      };
  }
}
