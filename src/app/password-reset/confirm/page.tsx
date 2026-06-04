import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PasswordResetConfirmForm } from "@/components/auth/PasswordResetConfirmForm";
import { PageContainer } from "@/components/shared/PageContainer";
import { PublicShell } from "@/components/shared/PublicShell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.passwordResetConfirm");
  return { title: t("metaTitle") };
}

export default function PasswordResetConfirmPage() {
  return (
    <PublicShell>
      <PageContainer size="narrow">
        <PasswordResetConfirmForm />
      </PageContainer>
    </PublicShell>
  );
}
