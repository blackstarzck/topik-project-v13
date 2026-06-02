"use client";

import { Button, Card, Col, Row, Space, Statistic, Typography } from "antd";
import { useTranslations } from "next-intl";
import Link from "next/link";

const { Text } = Typography;

/**
 * B-01 area 2 — KPI 요약.
 *
 * Wireframe Number Map area 2: "오늘 제출, 최근 첨삭, 목표 달성, 연속 학습".
 * 제약 조건: KPI 4개 이하, 수치 라벨 1줄, 업데이트 시각 표시.
 * 예외: 신규 사용자는 0값 대신 시작 유도 문구를 표시.
 */

export type DashboardKpiData = {
  todayAttempts: number;
  totalAttempts: number;
  /** 최근 첨삭(받은 피드백) 건수. */
  recentFeedbackCount: number;
  /** 목표 달성률(%) — 목표 없으면 null. */
  goalAchievementPct: number | null;
  streakDays: number;
  /** 데이터 기준 시각(ISO). */
  updatedAt: string;
};

type Props = {
  kpi: DashboardKpiData;
};

export function DashboardKpiSummary({ kpi }: Props) {
  const t = useTranslations("dashboard.kpi");
  const isNewUser =
    kpi.todayAttempts === 0 &&
    kpi.totalAttempts === 0 &&
    kpi.streakDays === 0 &&
    kpi.recentFeedbackCount === 0;

  const updatedLabel = new Date(kpi.updatedAt).toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isNewUser) {
    // 예외: 신규 사용자는 0값 대신 시작 유도 문구.
    return (
      <Card>
        <Space
          direction="vertical"
          size="small"
          style={{ width: "100%", textAlign: "center" }}
        >
          <Text strong style={{ fontSize: 16 }}>
            {t("newUserTitle")}
          </Text>
          <Text type="secondary">{t("newUserBody")}</Text>
          <Link href="/practice/recommendations">
            <Button type="primary">{t("newUserCta")}</Button>
          </Link>
        </Space>
      </Card>
    );
  }

  return (
    <Space direction="vertical" size={8} style={{ width: "100%" }}>
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <Card size="small" style={{ height: "100%" }}>
            <Statistic
              title={t("todaySubmissionsTitle")}
              value={kpi.todayAttempts}
              suffix={t("todaySubmissionsSuffix")}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" style={{ height: "100%" }}>
            <Statistic
              title={t("recentFeedbackTitle")}
              value={kpi.recentFeedbackCount}
              suffix={t("recentFeedbackSuffix")}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" style={{ height: "100%" }}>
            <Statistic
              title={t("goalAchievementTitle")}
              value={kpi.goalAchievementPct != null ? kpi.goalAchievementPct : "—"}
              suffix={kpi.goalAchievementPct != null ? "%" : undefined}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" style={{ height: "100%" }}>
            <Statistic
              title={t("streakTitle")}
              value={kpi.streakDays}
              suffix={t("streakSuffix")}
            />
          </Card>
        </Col>
      </Row>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {t("updatedAt", { time: updatedLabel })}
      </Text>
    </Space>
  );
}
