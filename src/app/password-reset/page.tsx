import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { PasswordResetRequestForm } from "@/components/auth/PasswordResetRequestForm";
import { AppCard } from "@/components/shared/AppCard";
import { PageContainer } from "@/components/shared/PageContainer";
import { PublicShell } from "@/components/shared/PublicShell";
import { SPACING } from "@/theme/spacing";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.passwordReset");
  return { title: t("metaTitle") };
}

export default async function PasswordResetPage() {
  const t = await getTranslations("auth.passwordReset");
  return (
    <PublicShell>
      <PageContainer size="narrow">
        <h1 style={{ textAlign: "center", fontSize: 24, marginBottom: SPACING.lg }}>
          {t("pageHeading")}
        </h1>
        <AppCard>
          <PasswordResetRequestForm />
        </AppCard>
        <p style={{ textAlign: "center", marginTop: SPACING.md }}>
          <Link href="/login">{t("backToLogin")}</Link>
        </p>
      </PageContainer>
    </PublicShell>
  );
}
