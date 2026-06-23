import { redirect } from "next/navigation";

import { requireActiveSession } from "@/lib/auth/profile";
import { addGoogleLinkedNotice } from "@/lib/auth/identity-linking";
import { getAuthCompletionStatusForSession } from "@/lib/auth/completion";
import { backfillOAuthDisplayName } from "@/lib/legal/consent";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type AuthIntent = "login" | "sign-up";

function pickFirst(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseIntent(value: string | undefined): AuthIntent {
  return value === "sign-up" ? "sign-up" : "login";
}

export default async function PostAuthPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const intent = parseIntent(pickFirst(params.intent));
  // 회원 탈퇴(deleted)/차단(blocked) 계정은 어떤 mutation(backfill 등) 전에 차단.
  const { user } = await requireActiveSession();
  const profile = await backfillOAuthDisplayName(user);

  const completionStatus = await getAuthCompletionStatusForSession({
    user,
    profile,
  });
  if (
    completionStatus === "pending-auth-completion" ||
    completionStatus === "pending-consent"
  ) {
    const consentNext = `/auth/post-auth?intent=${intent}`;
    redirect(`/auth/consent?next=${encodeURIComponent(consentNext)}`);
  }

  redirect(
    addGoogleLinkedNotice(
      completionStatus === "ready" ? "/dashboard" : "/onboarding/learning-goal",
      user,
    ),
  );
}
