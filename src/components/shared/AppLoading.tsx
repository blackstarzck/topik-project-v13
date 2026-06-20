"use client";

import { Spin } from "antd";
import { useTranslations } from "next-intl";

export function AppLoading({ tip }: { tip?: string }) {
  const t = useTranslations("shared.loading");
  // tip 미지정 시 카탈로그 기본 문구로 폴백(호출자가 명시한 tip 은 그대로 존중).
  return (
    <div className="flex min-h-[calc(100dvh-100px)] items-center justify-center px-4 md:min-h-[calc(100dvh-48px)]">
      <Spin description={tip ?? t("tip")} size="large" />
    </div>
  );
}
