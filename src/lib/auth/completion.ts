import type { User } from "@supabase/supabase-js";

import { isEmailVerified } from "@/lib/auth/access-gate";
import { bootstrapProfile, getSessionAndProfile } from "@/lib/auth/profile";
import type {
  AuthCompletionStatus,
  LandingAuthStatus,
} from "@/lib/auth/completion-routes";
import { resolveLocaleForProfile } from "@/i18n/request";
import { hasCompletedRequiredProfile } from "@/lib/auth/profile-completion";
import { getCurrentUser } from "@/lib/auth/session";
import { getMissingRequiredConsentDocuments } from "@/lib/legal/consent";
import { hasLearningGoal } from "@/lib/learning/server";
import type { Tables } from "@/lib/supabase/types";

export type {
  AuthCompletionStatus,
  LandingAuthStatus,
} from "@/lib/auth/completion-routes";

export type AuthenticatedSession = {
  user: User;
  profile: Tables<"profiles">;
};

export async function hasCompletedRequiredConsent({
  user,
  profile,
}: AuthenticatedSession): Promise<boolean> {
  const consentLocale = await resolveLocaleForProfile(profile);
  const missingDocuments = await getMissingRequiredConsentDocuments(
    user.id,
    consentLocale,
  );
  return missingDocuments.length === 0;
}

export async function getAuthCompletionStatusForSession(
  session: AuthenticatedSession,
): Promise<Exclude<AuthCompletionStatus, "anonymous">> {
  if (!hasCompletedRequiredProfile(session.profile)) {
    return "pending-auth-completion";
  }

  const hasConsent = await hasCompletedRequiredConsent(session);
  if (!hasConsent) return "pending-auth-completion";

  const hasGoal = await hasLearningGoal(session.user.id);
  return hasGoal ? "ready" : "pending-learning-goal";
}

export async function getCurrentAuthCompletionStatus(): Promise<AuthCompletionStatus> {
  const session = await getSessionAndProfile();
  if (!session) return "anonymous";
  return getAuthCompletionStatusForSession(session);
}

export async function getCurrentLandingAuthStatus(): Promise<LandingAuthStatus> {
  let user: User | null;

  try {
    user = await getCurrentUser();
  } catch (error) {
    console.warn("Failed to read auth user for landing CTA.", error);
    return "anonymous";
  }

  if (!user) return "anonymous";
  if (!isEmailVerified(user)) return "email-unverified";

  try {
    const profile = await bootstrapProfile(user.id);
    return await getAuthCompletionStatusForSession({ user, profile });
  } catch (error) {
    console.warn("Failed to resolve landing auth completion status.", error);
    return "authenticated-recovery";
  }
}
