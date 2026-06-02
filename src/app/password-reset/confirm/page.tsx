import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PasswordResetConfirmForm } from "@/components/auth/PasswordResetConfirmForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.passwordResetConfirm");
  return { title: t("metaTitle") };
}

export default function PasswordResetConfirmPage() {
  return (
    <main style={{ padding: "2rem 1rem", maxWidth: 520, margin: "0 auto" }}>
      <PasswordResetConfirmForm />
    </main>
  );
}
