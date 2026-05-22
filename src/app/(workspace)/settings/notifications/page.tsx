import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getProfileSettings } from "@/lib/settings/server";
import { NotificationPrefsForm } from "@/components/settings/NotificationPrefsForm";

export const metadata: Metadata = { title: "알림 설정 — TALKPIK" };

export default async function NotificationsSettingsPage() {
  const user = await requireUser();
  const settings = await getProfileSettings(user.id);
  if (!settings) notFound();
  return (
    <main style={{ padding: 24, maxWidth: 560 }}>
      <h1>알림 설정</h1>
      <NotificationPrefsForm
        userId={user.id}
        initialPrefs={settings.notification_prefs}
      />
    </main>
  );
}
