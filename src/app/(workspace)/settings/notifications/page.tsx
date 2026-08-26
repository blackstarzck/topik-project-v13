import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getProfileSettings } from "@/lib/settings/server";
import { NotificationPrefsForm } from "@/components/settings/NotificationPrefsForm";
import { PageHeader } from "@/components/shared/PageHeader";
import { SettingsPageFrame } from "@/components/shared/SettingsPageFrame";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.notifications");
  return { title: t("metaTitle") };
}

export default async function NotificationsSettingsPage() {
  const t = await getTranslations("settings.notifications");
  const user = await requireUser();
  const settings = await getProfileSettings(user.id);
  if (!settings) notFound();
  return (
    <SettingsPageFrame>
      <PageHeader title={t("pageHeading")} subtitle={t("pageSubtitle")} />
      <NotificationPrefsForm
        userId={user.id}
        initialPrefs={settings.notification_prefs}
      />
    </SettingsPageFrame>
  );
}
