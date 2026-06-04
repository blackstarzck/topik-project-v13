import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Suspense } from "react";

import { AuthMascot } from "@/components/auth/AuthMascot";
import { LoginForm } from "@/components/auth/LoginForm";
import { AppCard } from "@/components/shared/AppCard";
import { PageContainer } from "@/components/shared/PageContainer";
import { PublicShell } from "@/components/shared/PublicShell";
import { SPACING } from "@/theme/spacing";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.login");
  return { title: t("metaTitle") };
}

export default async function LoginPage() {
  const t = await getTranslations("auth.login");
  const tSignUp = await getTranslations("auth.signUp");
  const tMascot = await getTranslations("auth.mascot");
  return (
    <PublicShell>
      <PageContainer size="narrow">
        {/* §1 환영/브랜드 영역 + §2 마스코트 안내 (이미지 실패 시 이모지 fallback) */}
        <section style={{ textAlign: "center", marginBottom: SPACING.lg }}>
          <AuthMascot
            alt={tMascot("loginAlt")}
            emoji="🐥"
            size={44}
            caption={t("mascotCaption")}
          />
          <h1 style={{ fontSize: 24, margin: "8px 0 0" }}>
            {t("pageHeading")}
          </h1>
        </section>
        {/* §3 로그인 입력 폼 — calm raised surface (DESIGN.md → Components.card) */}
        <AppCard>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </AppCard>
        <p style={{ textAlign: "center", marginTop: SPACING.md }}>
          {t("noAccountPrompt")}{" "}
          <Link href="/sign-up">{tSignUp("pageHeading")}</Link>
        </p>
      </PageContainer>
    </PublicShell>
  );
}
