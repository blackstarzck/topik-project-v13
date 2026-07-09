import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { completeAuthGateAction } from "@/app/auth/consent/actions";
import {
  AuthConsentPanel,
  type AuthConsentPanelError,
} from "@/components/auth/AuthConsentPanel";
import { PageContainer } from "@/components/shared/PageContainer";
import { PublicShell } from "@/components/shared/PublicShell";
import { resolveLocaleForProfile } from "@/i18n/request";
import { sanitizeAuthCompletionNext } from "@/lib/auth/completion-routes";
import { getMissingRequiredProfileFields } from "@/lib/auth/profile-completion";
import { requireVerifiedActiveSession } from "@/lib/auth/access-gate";
import {
  generateRandomNickname,
  getMissingRequiredConsentDocuments,
} from "@/lib/legal/consent";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function pickFirst(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseError(value: string | undefined): AuthConsentPanelError | null {
  if (
    value === "required" ||
    value === "invalid-profile" ||
    value === "nickname-taken" ||
    value === "save-failed"
  ) {
    return value;
  }
  return null;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.consent");
  return { title: t("metaTitle") };
}

export default async function AuthConsentPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const next = sanitizeAuthCompletionNext(
    pickFirst(params.next),
    "/auth/post-auth?intent=login",
  );
  const error = parseError(pickFirst(params.error));
  const { user, profile } = await requireVerifiedActiveSession();
  const missingProfileFields = getMissingRequiredProfileFields(profile);
  const consentLocale = await resolveLocaleForProfile(profile);
  const missingDocuments = await getMissingRequiredConsentDocuments(
    user.id,
    consentLocale,
  );

  if (missingProfileFields.length === 0 && missingDocuments.length === 0) {
    redirect(next);
  }

  return (
    <PublicShell>
      <PageContainer size="default">
        <AuthConsentPanel
          action={completeAuthGateAction}
          documents={missingDocuments}
          next={next}
          profile={profile}
          missingProfileFields={missingProfileFields}
          suggestedNickname={
            missingProfileFields.includes("nickname")
              ? generateRandomNickname()
              : null
          }
          error={error}
          showRequiredError={error === "required"}
        />
      </PageContainer>
    </PublicShell>
  );
}
