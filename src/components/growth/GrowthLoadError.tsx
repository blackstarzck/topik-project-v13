"use client";

import { Button, Result } from "antd";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

/**
 * X-02 area 3 예외 — 차트/지표 로드 실패 시 재시도 버튼을 제공한다.
 * 사용자를 막다른 길에 두지 않도록 정직한 안내 + 다시 시도 동선을 노출한다.
 */
export function GrowthLoadError() {
  const t = useTranslations("growth.error");
  const router = useRouter();
  return (
    <Result
      status="warning"
      title={t("title")}
      subTitle={t("subTitle")}
      extra={
        <Button type="primary" onClick={() => router.refresh()}>
          {t("retry")}
        </Button>
      }
    />
  );
}
