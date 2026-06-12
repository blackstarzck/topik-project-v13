"use client";

import { useTranslations } from "next-intl";

import { PageHeader } from "@/components/shared/PageHeader";

/**
 * B-01 home dashboard header. description.md 목적: "현재 학습 상태와 다음 행동을
 * 요약해 홈 진입점을 만든다." Copy stays here; layout/semantics (level-1
 * heading) come from PageHeader.
 */
export function DashboardHeader() {
  const t = useTranslations("dashboard.header");
  return (
    <PageHeader
      title={t("title")}
      subtitle={t("subtitle")}
    />
  );
}
