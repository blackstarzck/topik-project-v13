import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { WorkspaceBody } from "@/components/app/WorkspaceBody";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { PageHeader } from "@/components/shared/PageHeader";
import { requireUser } from "@/lib/auth/session";
import { getProfileSettings } from "@/lib/settings/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile.page");
  return { title: t("metaTitle") };
}

export default async function ProfilePage() {
  const t = await getTranslations("profile.page");
  const user = await requireUser();
  const settings = await getProfileSettings(user.id);
  if (!settings) notFound();

  const supabase = await createSupabaseServerClient();
  const { data: profileMeta } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <WorkspaceBody>
      <div className="w-full max-w-[640px]">
        <PageHeader title={t("heading")} subtitle={t("subtitle")} />
        <ProfileForm
          userId={user.id}
          accountEmail={user.email ?? null}
          initialAvatarPath={profileMeta?.avatar_path ?? null}
          initialProfile={{
            display_name: settings.display_name,
            nickname: settings.nickname,
            nationality_country_code: settings.nationality_country_code,
            phone_country_code: settings.phone_country_code,
            phone_number: settings.phone_number,
            bio: settings.bio,
          }}
          showAccountEmail={false}
        />
      </div>
    </WorkspaceBody>
  );
}
