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
          className="mb-4 flex justify-center gap-3"
        >
          {[MailCheck, ShieldCheck].map((Icon, index) => (
            <span
              key={index}
              className="inline-flex size-11 items-center justify-center rounded-full border border-border bg-surface text-text"
            >
              <Icon size={22} />
            </span>
          ))}
        </div>
        <h1 className="mb-6 text-center text-2xl font-semibold">
          {t("pageHeading")}
        </h1>
        <AppCard data-testid="password-reset-request-card">
          <PasswordResetRequestForm />
        </AppCard>
        <p className="mt-4 text-center">
          <Link href="/login">{t("backToLogin")}</Link>
        </p>
      </PageContainer>
    </PublicShell>
  );
}
