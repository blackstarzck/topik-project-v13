import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { VerifyEmailCard } from "@/components/auth/VerifyEmailCard";
import { PageContainer } from "@/components/shared/PageContainer";
import { PublicShell } from "@/components/shared/PublicShell";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.verifyEmail");
  return { title: t("metaTitle") };
}

export default async function VerifyEmailPage() {
  const t = await getTranslations("auth.verifyEmail");
  return (
    <PublicShell>
      <PageContainer size="narrow" className="verify-email-page-container">
        <h1 className="sr-only">{t("srHeading")}</h1>
        <Suspense fallback={null}>
          <VerifyEmailCard />
        </Suspense>
      </PageContainer>
    </PublicShell>
  );
}
