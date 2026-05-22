import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getProfileSettings } from "@/lib/settings/server";
import { LanguageForm } from "@/components/settings/LanguageForm";

export const metadata: Metadata = { title: "언어 설정 — TALKPIK" };

export default async function LanguageSettingsPage() {
  const user = await requireUser();
  const settings = await getProfileSettings(user.id);
  if (!settings) notFound();
  return (
    <main style={{ padding: 24, maxWidth: 560 }}>
      <h1>언어 설정</h1>
      <LanguageForm userId={user.id} initialLocale={settings.ui_locale} />
    </main>
  );
}
