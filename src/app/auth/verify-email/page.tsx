import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { VerifyEmailCard } from "@/components/auth/VerifyEmailCard";
import { PageContainer } from "@/components/shared/PageContainer";
import { PublicShell } from "@/components/shared/PublicShell";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.verifyEmail");
  return { title: t("metaTitle") };
}

const srOnlyStyle: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

export default async function VerifyEmailPage() {
  const t = await getTranslations("auth.verifyEmail");
  return (
    <PublicShell>
      <PageContainer size="narrow">
        <h1 style={srOnlyStyle}>{t("srHeading")}</h1>
        <Suspense fallback={null}>
          <VerifyEmailCard />
        </Suspense>
      </PageContainer>
    </PublicShell>
  );
}
