"use client";

import { Button } from "antd";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { PageHeader } from "@/components/shared/PageHeader";

/**
 * B-01 home dashboard header. description.md 목적: "현재 학습 상태와 다음 행동을
 * 요약해 홈 진입점을 만든다." Uses the shared PageHeader primitive so the home
 * entry point has one clear forward action ("학습 시작") that points at the
 * practice/recommendation flow. Copy stays here; layout/semantics (level-1
 * heading + actions) come from PageHeader.
 */
export function DashboardHeader() {
  const t = useTranslations("dashboard.header");
  return (
    <PageHeader
      title={t("title")}
      subtitle={t("subtitle")}
      actions={
        <Link href="/practice/recommendations">
          <Button type="primary" size="large">
            {t("startCta")}
          </Button>
        </Link>
      }
    />
  );
}
