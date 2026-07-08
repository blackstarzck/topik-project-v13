import { redirect } from "next/navigation";

import { requireVerifiedActiveSession } from "@/lib/auth/access-gate";
import {
  GOOGLE_LINK_INTENT,
  addGoogleLinkedNotice,
  shouldAddGoogleLinkedNotice,
} from "@/lib/auth/identity-linking";
import { getAuthCompletionStatusForSession } from "@/lib/auth/completion";
import { backfillOAuthDisplayName } from "@/lib/legal/consent";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type AuthIntent = "login" | "sign-up" | typeof GOOGLE_LINK_INTENT;

function pickFirst(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseIntent(value: string | undefined): AuthIntent {
  if (value === "sign-up" || value === GOOGLE_LINK_INTENT) return value;
  return "login";
}

export default async function PostAuthPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const intent = parseIntent(pickFirst(params.intent));
  // 회원 탈퇴(deleted)/차단(blocked) 계정은 어떤 mutation(backfill 등) 전에 차단.
  const { user } = await requireVerifiedActiveSession();
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

  const destination =
    completionStatus === "ready" ? "/dashboard" : "/onboarding/learning-goal";
  redirect(
    shouldAddGoogleLinkedNotice(user, intent)
      ? addGoogleLinkedNotice(destination)
      : destination,
  );
}
