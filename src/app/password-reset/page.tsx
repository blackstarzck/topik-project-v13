import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PasswordResetRequestForm } from "@/components/auth/PasswordResetRequestForm";
import { AppCard } from "@/components/shared/AppCard";
import { PageContainer } from "@/components/shared/PageContainer";
import { PublicShell } from "@/components/shared/PublicShell";

type PasswordResetSearchParams = {
  email?: string | string[];
};

type PasswordResetPageProps = {
  searchParams?: Promise<PasswordResetSearchParams>;
};

function initialEmailFromSearchParams(
  params: PasswordResetSearchParams,
): string | undefined {
  const raw = Array.isArray(params.email) ? params.email[0] : params.email;
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, 320);
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.passwordReset");
  return { title: t("metaTitle") };
}

export default async function PasswordResetPage({
  searchParams,
}: PasswordResetPageProps) {
  const t = await getTranslations("auth.passwordReset");
  const params = searchParams ? await searchParams : {};
  const initialEmail = initialEmailFromSearchParams(params);
  return (
    <PublicShell>
      <PageContainer size="narrow" className="password-reset-page-container">
        <AppCard
          data-testid="password-reset-request-card"
          className="password-reset-card"
        >
          <div className="password-reset-card__header">
            <h1 className="m-0 text-center text-2xl font-semibold">
              {t("pageHeading")}
            </h1>
          </div>
          <PasswordResetRequestForm initialEmail={initialEmail} />
        </AppCard>
      </PageContainer>
    </PublicShell>
  );
}
