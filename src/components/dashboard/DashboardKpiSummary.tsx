"use client";

import { Button, Card, Col, Row, Space, Statistic, Typography } from "antd";
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
            첫 학습을 시작해 볼까요?
          </Text>
          <Text type="secondary">
            문제를 풀고 글쓰기를 제출하면 오늘 제출·최근 첨삭·목표 달성 지표가
            여기에 채워져요.
          </Text>
          <Link href="/practice/recommendations">
            <Button type="primary">추천 문제로 시작하기</Button>
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
            <Statistic title="오늘 제출" value={kpi.todayAttempts} suffix="회" />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" style={{ height: "100%" }}>
            <Statistic
              title="최근 첨삭"
              value={kpi.recentFeedbackCount}
              suffix="건"
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" style={{ height: "100%" }}>
            <Statistic
              title="목표 달성"
              value={kpi.goalAchievementPct != null ? kpi.goalAchievementPct : "—"}
              suffix={kpi.goalAchievementPct != null ? "%" : undefined}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" style={{ height: "100%" }}>
            <Statistic title="연속 학습" value={kpi.streakDays} suffix="일" />
          </Card>
        </Col>
      </Row>
      <Text type="secondary" style={{ fontSize: 12 }}>
        업데이트: {updatedLabel} 기준
      </Text>
    </Space>
  );
}
