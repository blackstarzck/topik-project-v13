import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { WorkspaceBody } from "@/components/app/WorkspaceBody";
import { AccountDeletionCard } from "@/components/profile/AccountDeletionCard";
import { AccountLoginMethodsCard } from "@/components/profile/AccountLoginMethodsCard";
import { ProfileLogoutForm } from "@/components/profile/ProfileLogoutForm";
import { StatusHelpCard } from "@/components/profile/StatusHelpCard";
import { PageHeader } from "@/components/shared/PageHeader";
import { requireUser } from "@/lib/auth/session";
import { getProfileSettings } from "@/lib/settings/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.account");
  return { title: t("metaTitle") };
}

export default async function AccountSettingsPage() {
  const t = await getTranslations("settings.account");
  const tNav = await getTranslations("nav");
  const tLoginMethods = await getTranslations("profile.loginMethods");
  const user = await requireUser();
  const settings = await getProfileSettings(user.id);
  if (!settings) notFound();

  const supabase = await createSupabaseServerClient();
  const { data: profileMeta } = await supabase
    .from("profiles")
    .select("created_at, app_role, plan_label, affiliation_code")
    .eq("id", user.id)
    .maybeSingle();
  const loginMethodLabels = {
    regionAriaLabel: tLoginMethods("regionAriaLabel"),
    emailMethod: tLoginMethods("emailMethod"),
    emailUnavailable: tLoginMethods("emailUnavailable"),
    googleMethod: tLoginMethods("googleMethod"),
    googleDescription: tLoginMethods("googleDescription"),
    passwordMethod: tLoginMethods("passwordMethod"),
    passwordDescription: tLoginMethods("passwordDescription"),
    passwordAction: tLoginMethods("passwordAction"),
    passwordSent: tLoginMethods("passwordSent"),
    passwordRateLimited: tLoginMethods("passwordRateLimited"),
    passwordSendFailed: tLoginMethods("passwordSendFailed"),
    connected: tLoginMethods("connected"),
    disconnected: tLoginMethods("disconnected"),
    connectGoogle: tLoginMethods("connectGoogle"),
    connectFailed: tLoginMethods("connectFailed"),
    linkStarted: tLoginMethods("linkStarted"),
  };

  return (
    <WorkspaceBody>
      <div className="w-full max-w-[640px]">
        <PageHeader title={t("pageHeading")} />
        <div className="account-settings-redesign">
          <AccountLoginMethodsCard
            accountEmail={user.email ?? null}
            labels={loginMethodLabels}
          />
          {profileMeta ? (
            <StatusHelpCard
              joinedAt={profileMeta.created_at}
              appRole={profileMeta.app_role}
              planLabel={profileMeta.plan_label}
              affiliationCode={profileMeta.affiliation_code}
            />
          ) : null}
          <ProfileLogoutForm label={tNav("logout")} />
          <AccountDeletionCard />
        </div>
      </div>
    </WorkspaceBody>
  );
}
