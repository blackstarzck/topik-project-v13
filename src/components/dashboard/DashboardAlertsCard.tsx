"use client";

import { Alert, Button, Empty, Space } from "antd";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AppCard } from "@/components/shared/AppCard";

export type DashboardAlertItem = {
  id: string;
  level: "info" | "warning";
  title: string;
  description?: string;
};

type Props = {
  alerts: DashboardAlertItem[];
  /** 알림 로드 실패 여부 — true면 재시도 + 설정 이동 CTA. */
  loadFailed?: boolean;
};

/**
 * B-01 area 4 — 일정/알림 보조 영역.
 *
 * 제약 조건: 알림 항목 5개 이하, 날짜 표기는 로케일 기준(부모가 ko-KR 포맷 적용).
 * 예외: 알림 로드 실패 시 재시도와 설정 이동 CTA 제공.
 */
export function DashboardAlertsCard({ alerts, loadFailed = false }: Props) {
  const t = useTranslations("dashboard.alerts");
  const router = useRouter();

  return (
    <AppCard
      title={t("cardTitle")}
      extra={
        <Link href="/settings/notifications">
          <Button type="link" size="small">
            {t("settingsLink")}
          </Button>
        </Link>
      }
    >
      {loadFailed ? (
        <Space orientation="vertical" size="small" style={{ width: "100%" }}>
          <Alert
            type="warning"
            showIcon
            message={t("loadFailedMessage")}
            description={t("loadFailedDescription")}
          />
          <Space wrap>
            <Button type="primary" onClick={() => router.refresh()}>
              {t("retry")}
            </Button>
            <Link href="/settings/notifications">
              <Button>{t("goToSettings")}</Button>
            </Link>
          </Space>
        </Space>
      ) : alerts.length === 0 ? (
        <Empty description={t("empty")} />
      ) : (
        <Space orientation="vertical" style={{ width: "100%" }}>
          {alerts.slice(0, 5).map((a) => (
            <Alert
              key={a.id}
              type={a.level}
              message={a.title}
              description={a.description}
              showIcon
            />
          ))}
        </Space>
      )}
    </AppCard>
  );
}
