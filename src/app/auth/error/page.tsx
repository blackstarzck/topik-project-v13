import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AuthErrorCard } from "@/components/auth/AuthErrorCard";
import { PageContainer } from "@/components/shared/PageContainer";
import { PublicShell } from "@/components/shared/PublicShell";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.error");
  return { title: t("metaTitle") };
}

export default async function AuthErrorPage() {
  const t = await getTranslations("auth.error");
  return (
    <PublicShell>
      <PageContainer size="narrow">
        <h1 className="sr-only">{t("srHeading")}</h1>
        <Suspense fallback={null}>
          <AuthErrorCard />
        </Suspense>
      </PageContainer>
    </PublicShell>
  );
}
