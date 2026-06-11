"use client";

import { Button } from "antd";
import { ArrowUpRight, LogIn } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

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
  isAuthenticated: boolean;
};

export function LandingHeader({ isAuthenticated }: Props) {
  const t = useTranslations("landing");

  return (
    <header className="landing-header !shadow-none !backdrop-blur-sm before:!hidden after:!hidden">
      <a href="#top" className="landing-header-logo" aria-label={t("logoAria")}>
        TALKPIK<span> AI</span>
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

      {isAuthenticated ? (
        <Link href="/dashboard">
          <Button
            className="landing-header-button landing-header-button--primary"
            icon={<ArrowUpRight size={14} aria-hidden="true" />}
            iconPlacement="end"
          >
            {t("ctaDashboard")}
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
          <Link href="/sign-up">
            <Button
              className="landing-header-button landing-header-button--primary"
              icon={<ArrowUpRight size={14} aria-hidden="true" />}
              iconPlacement="end"
            >
              {t("ctaSignUp")}
            </Button>
          </Link>
        </div>
      )}
    </header>
  );
}
