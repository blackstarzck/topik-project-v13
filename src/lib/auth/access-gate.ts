import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { APP_ROUTES } from "@/lib/routes";
import {
  createSupabaseServerClient,
  type SupabaseServerClient,
} from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";
import { isActiveStatus, requireActiveSession } from "@/lib/auth/profile";

type ClientFactory = () => Promise<SupabaseServerClient>;
type EmailVerificationShape = {
  email?: string | null;
  email_confirmed_at?: string | null;
};

export type AuthAccessGateStatus =
  | "anonymous"
  | "inactive"
  | "email-unverified"
  | "verified-active";

export type AuthAccessGateSession = {
  user: EmailVerificationShape;
  profile: Pick<Tables<"profiles">, "status">;
};

export function isEmailVerified(user: EmailVerificationShape): boolean {
  return user.email_confirmed_at != null;
}

export function buildVerifyEmailPath(user: { email?: string | null }): string {
  if (!user.email) return APP_ROUTES.authVerifyEmail;
  return `${APP_ROUTES.authVerifyEmail}?email=${encodeURIComponent(user.email)}`;
}

export function getAuthAccessGateStatusForSession(
  session: AuthAccessGateSession,
): Exclude<AuthAccessGateStatus, "anonymous"> {
  if (!isActiveStatus(session.profile.status)) return "inactive";
  if (!isEmailVerified(session.user)) return "email-unverified";
  return "verified-active";
}

export async function requireVerifiedActiveSession(
  createClient: ClientFactory = createSupabaseServerClient,
): Promise<{ user: User; profile: Tables<"profiles"> }> {
  const session = await requireActiveSession(createClient);
  if (!isEmailVerified(session.user)) {
    redirect(buildVerifyEmailPath(session.user));
  }
  return session;
}
