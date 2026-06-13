import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { acceptRequiredConsentsAction } from "@/app/auth/consent/actions";
import { AuthConsentPanel } from "@/components/auth/AuthConsentPanel";
import { PageContainer } from "@/components/shared/PageContainer";
import { PublicShell } from "@/components/shared/PublicShell";
import { sanitizeNext } from "@/lib/auth/error-mapping";
import { bootstrapProfile } from "@/lib/auth/profile";
import { requireUser } from "@/lib/auth/session";
import { getMissingRequiredConsentDocuments } from "@/lib/legal/consent";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function pickFirst(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
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
  const next = sanitizeNext(
    pickFirst(params.next),
    "/auth/post-auth?intent=login",
  );
  const showRequiredError = pickFirst(params.error) === "required";
  const user = await requireUser();
  const profile = await bootstrapProfile(user.id);
  const missingDocuments = await getMissingRequiredConsentDocuments(
    user.id,
    profile.ui_locale,
  );

  if (missingDocuments.length === 0) {
    redirect(next);
  }

  return (
    <PublicShell>
      <PageContainer size="narrow">
        <AuthConsentPanel
          action={acceptRequiredConsentsAction}
          documents={missingDocuments}
          next={next}
          showRequiredError={showRequiredError}
        />
      </PageContainer>
    </PublicShell>
  );
}
