import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import {
  backfillOAuthDisplayName,
  getMissingRequiredConsentDocuments,
  getRequiredConsentDocuments,
} from "@/lib/legal/consent";
import { hasLearningGoal } from "@/lib/learning/server";

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
  const user = await requireUser();
  const profile = await backfillOAuthDisplayName(user);

  const requiredDocuments = await getRequiredConsentDocuments(profile.ui_locale);
  if (requiredDocuments.length === 0) {
    console.warn("[auth/post-auth] no published required legal documents", {
      userId: user.id,
      locale: profile.ui_locale,
      intent,
    });
  } else {
    const missingDocuments = await getMissingRequiredConsentDocuments(
      user.id,
      profile.ui_locale,
    );
    if (missingDocuments.length > 0) {
      const consentNext = `/auth/post-auth?intent=${intent}`;
      redirect(`/auth/consent?next=${encodeURIComponent(consentNext)}`);
    }
  }

  const hasGoal = await hasLearningGoal(user.id);
  redirect(hasGoal ? "/dashboard" : "/onboarding/learning-goal");
}
