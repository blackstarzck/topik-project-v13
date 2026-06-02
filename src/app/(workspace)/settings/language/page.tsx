import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getProfileSettings } from "@/lib/settings/server";
import { LanguageForm } from "@/components/settings/LanguageForm";

export const metadata: Metadata = { title: "언어 설정 — TALKPIK" };

export default async function LanguageSettingsPage() {
  const user = await requireUser();
  const settings = await getProfileSettings(user.id);
  if (!settings) notFound();
  // i18n (G-01): server-side translation via getTranslations (RSC-safe).
  const t = await getTranslations("settings.language");
  return (
    <main style={{ padding: 24, maxWidth: 560 }}>
      <h1>{t("pageHeading")}</h1>
      <LanguageForm userId={user.id} initialLocale={settings.ui_locale} />
    </main>
  );
}
