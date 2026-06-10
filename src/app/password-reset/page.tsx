import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { MailCheck, ShieldCheck } from "lucide-react";

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
        <div
          aria-hidden="true"
          data-testid="password-reset-security-visual"
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 12,
            marginBottom: SPACING.md,
          }}
        >
          {[MailCheck, ShieldCheck].map((Icon, index) => (
            <span
              key={index}
              style={{
                display: "inline-flex",
                width: 44,
                height: 44,
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid #dbe4f0",
                borderRadius: 22,
                background: "#f7fafc",
                color: "#1668dc",
              }}
            >
              <Icon size={22} strokeWidth={2} />
            </span>
          ))}
        </div>
        <h1 style={{ textAlign: "center", fontSize: 24, marginBottom: SPACING.lg }}>
          {t("pageHeading")}
        </h1>
        <AppCard data-testid="password-reset-request-card">
          <PasswordResetRequestForm />
        </AppCard>
        <p style={{ textAlign: "center", marginTop: SPACING.md }}>
          <Link href="/login">{t("backToLogin")}</Link>
        </p>
      </PageContainer>
    </PublicShell>
  );
}
