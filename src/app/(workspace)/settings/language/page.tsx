import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getProfileSettings } from "@/lib/settings/server";
import { WorkspaceBody } from "@/components/app/WorkspaceBody";
import { LanguageForm } from "@/components/settings/LanguageForm";
import { PageHeader } from "@/components/shared/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.language");
  return { title: t("metaTitle") };
}

export default async function LanguageSettingsPage() {
  const user = await requireUser();
  const settings = await getProfileSettings(user.id);
  if (!settings) notFound();
  // i18n (G-01): server-side translation via getTranslations (RSC-safe).
  const t = await getTranslations("settings.language");
  return (
    <WorkspaceBody>
      <div className="w-full max-w-[640px]">
        <PageHeader title={t("pageHeading")} />
        <LanguageForm userId={user.id} initialLocale={settings.ui_locale} />
      </div>
    </WorkspaceBody>
  );
}
