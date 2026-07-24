import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/app/WorkspaceShell";
import { buildVerifyEmailPath, isEmailVerified } from "@/lib/auth/access-gate";
import { getAuthCompletionStatusForSession } from "@/lib/auth/completion";
import {
  ACCOUNT_INACTIVE_PATH,
  POST_AUTH_LOGIN_PATH,
} from "@/lib/auth/completion-routes";
import {
  getCurrentAccountState,
  getSessionAndProfile,
  isActiveStatus,
} from "@/lib/auth/profile";

// All workspace routes require an authenticated session, so they cannot be
// prerendered statically. Forcing dynamic also prevents `pnpm build` from
// evaluating server components without Supabase env vars during prerender.
export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const account = await getCurrentAccountState();
  if (!account) redirect("/login");
  if (!isActiveStatus(account.status)) {
    redirect(`${ACCOUNT_INACTIVE_PATH}?status=${account.status ?? "unknown"}`);
  }

  const session = await getSessionAndProfile();
  if (!session) redirect("/login");
  if (!isEmailVerified(session.user)) {
    redirect(buildVerifyEmailPath(session.user));
  }
  const completionStatus = await getAuthCompletionStatusForSession(session);
  if (
    completionStatus === "pending-auth-completion" ||
    completionStatus === "pending-consent"
  ) {
    redirect(POST_AUTH_LOGIN_PATH);
  }
  const { user, profile } = session;
  const hasPhoneNumberField = Object.prototype.hasOwnProperty.call(
    profile,
    "phone_number",
  );
  const hasPhoneNumberPromptDismissedField =
    Object.prototype.hasOwnProperty.call(
      profile,
      "phone_number_prompt_dismissed_at",
    );

  return (
    <WorkspaceShell
      role={profile.app_role}
      userId={user.id}
      email={user.email}
      displayName={profile.display_name}
      nickname={profile.nickname}
      avatarPath={profile.avatar_path}
      planLabel={profile.plan_label}
      affiliationCode={profile.affiliation_code}
      phoneNumber={hasPhoneNumberField ? profile.phone_number : undefined}
      phoneNumberPromptDismissedAt={
        hasPhoneNumberPromptDismissedField
          ? profile.phone_number_prompt_dismissed_at
          : undefined
      }
    >
      {children}
    </WorkspaceShell>
  );
}
