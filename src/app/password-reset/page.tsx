import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { MailCheck, ShieldCheck } from "lucide-react";

import { PasswordResetRequestForm } from "@/components/auth/PasswordResetRequestForm";
import { AppCard } from "@/components/shared/AppCard";
import { PageContainer } from "@/components/shared/PageContainer";
import { PublicShell } from "@/components/shared/PublicShell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.passwordReset");
  return { title: t("metaTitle") };
}

export default async function PasswordResetPage() {
  const t = await getTranslations("auth.passwordReset");
  return (
    <PublicShell>
      <PageContainer size="narrow">
        <div
          aria-hidden="true"
          data-testid="password-reset-security-visual"
          className="password-reset-security-visual"
        >
          {[MailCheck, ShieldCheck].map((Icon, index) => (
            <span
              key={index}
              className="password-reset-security-icon"
            >
              <Icon size={22} strokeWidth={2} />
            </span>
          ))}
        </div>
        <h1 className="password-reset-heading">
          {t("pageHeading")}
        </h1>
        <AppCard data-testid="password-reset-request-card">
          <PasswordResetRequestForm />
        </AppCard>
        <p className="password-reset-back-link">
          <Link href="/login">{t("backToLogin")}</Link>
        </p>
      </PageContainer>
    </PublicShell>
  );
}
