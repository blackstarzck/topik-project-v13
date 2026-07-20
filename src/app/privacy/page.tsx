import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { LegalDocument } from "@/components/legal/TermsDocument";
import { PageContainer } from "@/components/shared/PageContainer";
import { PublicShell } from "@/components/shared/PublicShell";
import { UnavailableState } from "@/components/shared/UnavailableState";
import { getPublishedLegalDocument } from "@/lib/legal/documents";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.privacy");
  return { title: t("metaTitle") };
}

export default async function PrivacyPage() {
  const locale = await getLocale();
  const doc = await getPublishedLegalDocument("privacy", locale).catch(
    () => null,
  );
  const legalT = await getTranslations("legal.privacy");
  const errorT = await getTranslations("shared.error");

  return (
    <PublicShell>
      <PageContainer size="default" className="legal-page-container">
        {doc ? (
          <LegalDocument doc={doc} testIdPrefix="privacy" />
        ) : (
          <UnavailableState
            variant="required-information"
            actions={[
              {
                key: "retry",
                label: errorT("retry"),
                href: "/privacy",
                primary: true,
              },
              { key: "home", label: legalT("linkHome"), href: "/" },
            ]}
          />
        )}
      </PageContainer>
    </PublicShell>
  );
}
