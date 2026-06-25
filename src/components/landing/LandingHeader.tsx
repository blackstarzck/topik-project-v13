"use client";

import { Button } from "antd";
import { ArrowUpRight, LogIn } from "@/components/shared/AppIcons";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { BrandLogo } from "@/components/shared/BrandLogo";
import type { LandingAuthStatus } from "@/lib/auth/completion-routes";
import { getLandingCta } from "./auth-cta";

type NavItem = {
  labelKey: "navFeatures" | "navPreview" | "navTerms";
  href: string;
};

const NAV_ITEMS: NavItem[] = [
  { labelKey: "navFeatures", href: "#features" },
  { labelKey: "navPreview", href: "#preview" },
  { labelKey: "navTerms", href: "/terms" },
];

type Props = {
  authStatus: LandingAuthStatus;
};

export function LandingHeader({ authStatus }: Props) {
  const t = useTranslations("landing");
  const authenticatedCta =
    authStatus === "anonymous" ? null : getLandingCta(authStatus);

  return (
    <header className="landing-header !shadow-none !backdrop-blur-sm before:!hidden after:!hidden">
      <a href="#top" className="landing-header-logo" aria-label={t("logoAria")}>
        <BrandLogo height={68} loading="eager" />
      </a>

      <nav className="landing-header-nav" aria-label={t("navAria")}>
        {NAV_ITEMS.map((item) =>
          item.href.startsWith("#") ? (
            <a key={item.href} href={item.href} className="landing-header-link">
              {t(item.labelKey)}
            </a>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              className="landing-header-link"
            >
              {t(item.labelKey)}
            </Link>
          ),
        )}
      </nav>

      {authenticatedCta ? (
        <Link href={authenticatedCta.href}>
          <Button
            className="landing-header-button landing-header-button--primary"
            icon={<ArrowUpRight size={14} aria-hidden="true" />}
            iconPlacement="end"
          >
            {t(authenticatedCta.headerLabelKey)}
          </Button>
        </Link>
      ) : (
        <div className="landing-header-actions">
          <Link href="/login">
            <Button
              className="landing-header-button landing-header-button--ghost"
              icon={<LogIn size={14} aria-hidden="true" />}
            >
              {t("ctaLogin")}
            </Button>
          </Link>
        </div>
      )}
    </header>
  );
}
