"use client";

import { Alert, Card, Space } from "antd";

export type DashboardAlert = {
  id: string;
  level: "info" | "warning";
  title: string;
  description?: string;
};

type Props = {
  alerts: DashboardAlert[];
};

/**
 * Phase 7-D Task 11 (P1-7) — B-01 알림/리마인더 카드.
 * 시험 D-day, 새 추천, 미완 답안 등 in-app banner. Tier 2 OOS-9 (외부 transport)
 * 없이 작동.
 */
export function AlertsCard({ alerts }: Props) {
  return (
    <Card title="알림">
      <Space direction="vertical" style={{ width: "100%" }}>
        {alerts.length === 0 ? (
          <Alert
            type="info"
            message="새 알림이 없어요."
            showIcon
          />
        ) : (
          alerts.map((a) => (
            <Alert
              key={a.id}
              type={a.level}
              message={a.title}
              description={a.description}
              showIcon
            />
          ))
        )}
      </Space>
    </Card>
  );
}
