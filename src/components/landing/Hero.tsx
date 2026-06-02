"use client";

import { useState } from "react";
import { Button, Space, Typography } from "antd";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { AuthMascot } from "@/components/auth/AuthMascot";

const { Title, Paragraph } = Typography;

type HeroProps = {
  /**
   * description §1/§3 exception: a logged-in visitor sees a 대시보드 CTA
   * instead of 무료 시작/로그인. Defaults to the public (logged-out) variant.
   */
  isAuthenticated?: boolean;
};

export function Hero({ isAuthenticated = false }: HeroProps) {
  const t = useTranslations("landing");
  const router = useRouter();
  // §3 제약: "클릭 후 중복 이동 차단" — once a primary CTA is pressed we lock
  // it so a double-click can't fire a second navigation.
  const [navigating, setNavigating] = useState(false);

  function go(href: string) {
    if (navigating) return;
    setNavigating(true);
    router.push(href);
  }

  return (
    <section
      id="top"
      style={{
        textAlign: "center",
        padding: "56px 16px 24px",
      }}
    >
      {/* §5 마스코트 — 첫 화면 CTA와 겹치지 않게 카피 위에 배치, 대체 텍스트 필수 */}
      <AuthMascot
        alt={t("heroMascotAlt")}
        emoji="🐥"
        size={64}
      />
      <Title level={1} style={{ marginTop: 16 }}>
        {t("heroTitle")}
      </Title>
      <Paragraph style={{ fontSize: 18 }}>{t("heroBody")}</Paragraph>
      {isAuthenticated ? (
        <Space size="middle" style={{ marginTop: 24 }}>
          <Button
            type="primary"
            size="large"
            loading={navigating}
            onClick={() => go("/dashboard")}
          >
            {t("heroCtaDashboard")}
          </Button>
        </Space>
      ) : (
        <Space size="middle" style={{ marginTop: 24 }}>
          <Button
            type="primary"
            size="large"
            loading={navigating}
            onClick={() => go("/sign-up")}
          >
            {t("heroCtaSignUp")}
          </Button>
          <Button
            size="large"
            disabled={navigating}
            onClick={() => go("/login")}
          >
            {t("heroCtaLogin")}
          </Button>
        </Space>
      )}
    </section>
  );
}
