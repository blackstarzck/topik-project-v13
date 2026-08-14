import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { TermsDocument } from "@/components/legal/TermsDocument";
import { PageContainer } from "@/components/shared/PageContainer";
import { PublicShell } from "@/components/shared/PublicShell";
import { UnavailableState } from "@/components/shared/UnavailableState";
import { getPublishedLegalDocument } from "@/lib/legal/documents";

// Public read-only projection of an admin-published terms document. Missing,
// placeholder, untrusted, or unreadable content fails closed to a broad retry
// state; temporary policy copy is never presented as the official document.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.terms");
  return { title: t("metaTitle") };
}

export default async function TermsPage() {
  const locale = await getLocale();
  const doc = await getPublishedLegalDocument("terms", locale).catch(
    () => null,
  );
  const errorT = await getTranslations("shared.error");
  const legalT = await getTranslations("legal.terms");

  return (
    <PublicShell>
      <PageContainer size="default" className="legal-page-container">
        {doc ? (
          <TermsDocument doc={doc} />
        ) : (
          <UnavailableState
            variant="required-information"
            actions={[
              {
                key: "retry",
                label: errorT("retry"),
                href: "/terms",
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
