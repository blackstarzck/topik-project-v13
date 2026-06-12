import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AuthPromptExperience } from "@/components/auth/AuthPromptExperience";
import { PublicShell } from "@/components/shared/PublicShell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.signUp");
  return { title: t("metaTitle") };
}

export default async function SignUpPage() {
  const t = await getTranslations("auth.signUp");
  const tCommon = await getTranslations("common");
  const tMascot = await getTranslations("auth.mascot");

  return (
    <PublicShell className="signup-prompt-shell">
      <AuthPromptExperience
        mode="sign-up"
        pageHeading={t("pageHeading")}
        formSubtitle={t("formSubtitle")}
        heroEyebrow={t("heroEyebrow")}
        mascotAlt={tMascot("signUpAlt")}
        switchPrompt={t("haveAccountPrompt")}
        switchHref="/login"
        switchLabel={tCommon("login")}
      />
    </PublicShell>
  );
}
