import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/app/WorkspaceShell";
import { buildVerifyEmailPath, isEmailVerified } from "@/lib/auth/access-gate";
import { getAuthCompletionStatusForSession } from "@/lib/auth/completion";
import {
  ACCOUNT_INACTIVE_PATH,
  POST_AUTH_LOGIN_PATH,
} from "@/lib/auth/completion-routes";
import { getSessionAndProfile, isActiveStatus } from "@/lib/auth/profile";

// All workspace routes require an authenticated session, so they cannot be
// prerendered statically. Forcing dynamic also prevents `pnpm build` from
// evaluating server components without Supabase env vars during prerender.
export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSessionAndProfile();
  if (!session) redirect("/login");
  // 회원 탈퇴(deleted)/차단(blocked) 계정 차단. status 는 profiles 에만 있어
  // proxy 의 getUser() 로는 알 수 없으므로 여기(및 /api 가드)가 권위 통제점이다.
  // 서버 컴포넌트는 쿠키를 못 지우므로 쿠키 정리용 GET route 로 보낸다(루프 방지).
  if (!isActiveStatus(session.profile.status)) {
    redirect(`${ACCOUNT_INACTIVE_PATH}?status=${session.profile.status}`);
  }
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
      phoneNumber={profile.phone_number ?? null}
      phoneNumberPromptDismissedAt={profile.phone_number_prompt_dismissed_at ?? null}
    >
      {children}
    </WorkspaceShell>
  );
}
