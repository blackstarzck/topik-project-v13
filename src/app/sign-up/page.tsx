import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { AuthMascot } from "@/components/auth/AuthMascot";
import { SignUpForm } from "@/components/auth/SignUpForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.signUp");
  return { title: t("metaTitle") };
}

// 혜택 칩 — description §2 제약: 3개 이하, 라벨 12자 이하. i18n: 라벨은
// auth.signUp.benefit* 키로 해석한다.
const benefitChipKeys = [
  "benefitFreeTrial",
  "benefitRealExam",
  "benefitWeaknessReport",
] as const;

const chipStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 12px",
  borderRadius: 999,
  background: "#f0f5ff",
  color: "#1d39c4",
  fontSize: 13,
  margin: "0 6px 6px 0",
};

export default async function SignUpPage() {
  const t = await getTranslations("auth.signUp");
  const tCommon = await getTranslations("common");
  const tMascot = await getTranslations("auth.mascot");
  return (
    <main style={{ padding: "2rem 1rem", maxWidth: 480, margin: "0 auto" }}>
      {/* description §1 브랜드 메시지 + §2 마스코트/혜택 영역. AuthMascot은
          이미지 실패 시 기본 캐릭터(이모지)로 자동 대체 — §2 예외와 호환. */}
      <section style={{ textAlign: "center", marginBottom: 24 }}>
        <AuthMascot alt={tMascot("signUpAlt")} emoji="✏️" size={44} />
        <h1 style={{ fontSize: 24, margin: "8px 0 4px" }}>{t("pageHeading")}</h1>
        <p style={{ color: "#595959", margin: "0 0 12px", fontSize: 14 }}>
          {t("pageSubtitle")}
        </p>
        <div>
          {benefitChipKeys.map((key) => (
            <span key={key} style={chipStyle}>
              {t(key)}
            </span>
          ))}
        </div>
      </section>
      <SignUpForm />
      <p style={{ textAlign: "center", marginTop: 16 }}>
        {t("haveAccountPrompt")} <Link href="/login">{tCommon("login")}</Link>
      </p>
    </main>
  );
}
