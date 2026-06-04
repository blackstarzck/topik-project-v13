"use client";

import { Col, Row, Space } from "antd";
import {
  RecentFeedbackCard,
  type RecentFeedbackItem,
} from "@/components/learning/RecentFeedbackCard";
import { UpcomingExamCard } from "@/components/learning/UpcomingExamCard";
import {
  DashboardKpiSummary,
  type DashboardKpiData,
} from "./DashboardKpiSummary";
import {
  DashboardRecommendations,
  type DashboardAlternative,
  type DashboardPrimary,
} from "./DashboardRecommendations";
import {
  DashboardAlertsCard,
  type DashboardAlertItem,
} from "./DashboardAlertsCard";

type Props = {
  kpi: DashboardKpiData;
  examDate: string | null;
  primary: DashboardPrimary | null;
  alternatives: DashboardAlternative[];
  recentFeedbacks: RecentFeedbackItem[];
  alerts: DashboardAlertItem[];
  alertsLoadFailed: boolean;
};

/**
 * B-01 홈 대시보드 본문.
 *
 * area 2 KPI 요약(오늘 제출/최근 첨삭/목표 달성/연속 학습 + 업데이트 시각),
 * area 3 추천/진행 카드(이어 풀 문제 + 추천 유형, 실제 추천 데이터),
 * area 4 일정/알림 보조 영역(시험 일정 + 알림 재시도/설정 CTA),
 * 최근 첨삭 카드. 신규 사용자 빈 상태는 KPI 요약 내부에서 시작 유도로 대체된다.
 */
export function DashboardBody({
  kpi,
  examDate,
  primary,
  alternatives,
  recentFeedbacks,
  alerts,
  alertsLoadFailed,
}: Props) {
  return (
    <Space orientation="vertical" size="large" style={{ width: "100%" }}>
      <DashboardKpiSummary kpi={kpi} />

      <Row gutter={[16, 16]}>
        <Col xs={24} md={16}>
          <DashboardRecommendations
            primary={primary}
            alternatives={alternatives}
          />
        </Col>
        <Col xs={24} md={8}>
          <Space orientation="vertical" size="large" style={{ width: "100%" }}>
            <UpcomingExamCard examDate={examDate} />
            <DashboardAlertsCard
              alerts={alerts}
              loadFailed={alertsLoadFailed}
            />
          </Space>
        </Col>
      </Row>

      <RecentFeedbackCard items={recentFeedbacks} />
    </Space>
  );
}
