import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getProfileSettings } from "@/lib/settings/server";
import { ProfileForm } from "@/components/profile/ProfileForm";

export const metadata: Metadata = { title: "프로필 — TALKPIK" };

export default async function ProfilePage() {
  const user = await requireUser();
  const settings = await getProfileSettings(user.id);
  if (!settings) notFound();
  return (
    <main style={{ padding: 24, maxWidth: 560 }}>
      <h1>프로필</h1>
      <ProfileForm
        userId={user.id}
        initialProfile={{
          display_name: settings.display_name,
          nickname: settings.nickname,
        }}
      />
    </main>
  );
}
