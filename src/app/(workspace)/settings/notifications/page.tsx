import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getProfileSettings } from "@/lib/settings/server";
import { WorkspaceBody } from "@/components/app/WorkspaceBody";
import { NotificationPrefsForm } from "@/components/settings/NotificationPrefsForm";
import { PageHeader } from "@/components/shared/PageHeader";

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
    <WorkspaceBody size="form">
      <PageHeader title={t("pageHeading")} />
      <NotificationPrefsForm
        userId={user.id}
        initialPrefs={settings.notification_prefs}
      />
    </WorkspaceBody>
  );
}
