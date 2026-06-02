import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { PasswordResetRequestForm } from "@/components/auth/PasswordResetRequestForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.passwordReset");
  return { title: t("metaTitle") };
}

export default async function PasswordResetPage() {
  const t = await getTranslations("auth.passwordReset");
  return (
    <main style={{ padding: "2rem 1rem", maxWidth: 480, margin: "0 auto" }}>
      <h1 style={{ textAlign: "center", fontSize: 24 }}>{t("pageHeading")}</h1>
      <PasswordResetRequestForm />
      <p style={{ textAlign: "center", marginTop: 16 }}>
        <Link href="/login">{t("backToLogin")}</Link>
      </p>
    </main>
  );
}
