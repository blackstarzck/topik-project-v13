import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AuthPromptExperience } from "@/components/auth/AuthPromptExperience";
import { PublicShell } from "@/components/shared/PublicShell";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.login");
  return { title: t("metaTitle") };
}

export default async function LoginPage() {
  const t = await getTranslations("auth.login");
  const tSignUp = await getTranslations("auth.signUp");
  const tTerms = await getTranslations("legal.terms");
  const tPrivacy = await getTranslations("legal.privacy");
  const tMascot = await getTranslations("auth.mascot");

  return (
    <PublicShell className="signup-prompt-shell">
      <AuthPromptExperience
        mode="login"
        pageHeading={t("pageHeading")}
        formSubtitle={t("formSubtitle")}
        heroEyebrow={t("heroEyebrow")}
        mascotAlt={tMascot("loginAlt")}
        switchPrompt={t("noAccountPrompt")}
        switchHref="/sign-up"
        switchLabel={tSignUp("pageHeading")}
        termsLabel={tTerms("heading")}
        privacyLabel={tPrivacy("heading")}
      />
    </PublicShell>
  );
}
