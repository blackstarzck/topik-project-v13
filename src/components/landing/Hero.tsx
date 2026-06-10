"use client";

import { useState } from "react";
import { Button, Typography } from "antd";
import { ArrowUpRight, LogIn } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

const { Title, Paragraph } = Typography;

type HeroProps = {
  isAuthenticated?: boolean;
};

export function Hero({ isAuthenticated = false }: HeroProps) {
  const t = useTranslations("landing");
  const router = useRouter();
  const [navigating, setNavigating] = useState(false);

  function go(href: string) {
    if (navigating) return;
    setNavigating(true);
    router.push(href);
  }

  return (
    <section className="landing-hero">
      <div className="landing-hero-copy">
        <p className="landing-hero-kicker">{t("heroKicker")}</p>
        <Title level={1} className="landing-hero-title">
          {t("heroTitle")}
        </Title>
        <Paragraph className="landing-hero-body">{t("heroBody")}</Paragraph>
        {isAuthenticated ? (
          <div className="landing-hero-actions">
            <Button
              type="primary"
              size="large"
              className="landing-hero-button landing-hero-button--primary"
              icon={<ArrowUpRight size={16} aria-hidden="true" />}
              iconPlacement="end"
              loading={navigating}
              onClick={() => go("/dashboard")}
            >
              {t("heroCtaDashboard")}
            </Button>
          </div>
        ) : (
          <div className="landing-hero-actions">
            <Button
              type="primary"
              size="large"
              className="landing-hero-button landing-hero-button--primary"
              icon={<ArrowUpRight size={16} aria-hidden="true" />}
              iconPlacement="end"
              loading={navigating}
              onClick={() => go("/sign-up")}
            >
              {t("heroCtaSignUp")}
            </Button>
            <Button
              size="large"
              className="landing-hero-button landing-hero-button--secondary"
              icon={<LogIn size={16} aria-hidden="true" />}
              disabled={navigating}
              onClick={() => go("/login")}
            >
              {t("heroCtaLogin")}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
