"use client";

import { useState } from "react";
import { Button, Typography } from "antd";
import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import type { LandingAuthStatus } from "@/lib/auth/completion-routes";
import { getLandingCta } from "./auth-cta";

const { Title, Paragraph } = Typography;

type HeroProps = {
  authStatus?: LandingAuthStatus;
};

export function Hero({ authStatus = "anonymous" }: HeroProps) {
  const t = useTranslations("landing");
  const router = useRouter();
  const [navigating, setNavigating] = useState(false);
  const authenticatedCta =
    authStatus === "anonymous" ? null : getLandingCta(authStatus);

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
        {authenticatedCta ? (
          <div className="landing-hero-actions">
            <Button
              type="primary"
              size="large"
              className="landing-hero-button landing-hero-button--primary"
              icon={<ArrowUpRight size={16} aria-hidden="true" />}
              iconPlacement="end"
              loading={navigating}
              onClick={() => go(authenticatedCta.href)}
            >
              {t(authenticatedCta.heroLabelKey)}
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
          </div>
        )}
      </div>
    </section>
  );
}
