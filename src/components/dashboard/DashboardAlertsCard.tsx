"use client";

import { Alert, Button, Card, Empty, Space } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
  const router = useRouter();

  return (
    <Card
      title="알림"
      extra={
        <Link href="/settings/notifications">
          <Button type="link" size="small">
            알림 설정
          </Button>
        </Link>
      }
    >
      {loadFailed ? (
        <Space direction="vertical" size="small" style={{ width: "100%" }}>
          <Alert
            type="warning"
            showIcon
            message="알림을 불러오지 못했어요."
            description="잠시 후 다시 시도하거나 알림 설정을 확인해 주세요."
          />
          <Space wrap>
            <Button type="primary" onClick={() => router.refresh()}>
              다시 시도
            </Button>
            <Link href="/settings/notifications">
              <Button>알림 설정으로 이동</Button>
            </Link>
          </Space>
        </Space>
      ) : alerts.length === 0 ? (
        <Empty description="새 알림이 없어요." />
      ) : (
        <Space direction="vertical" style={{ width: "100%" }}>
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
    </Card>
  );
}
