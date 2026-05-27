import { Col, Row, Space } from "antd";
import type { DashboardKpi } from "@/lib/learning/kpi";
import type { LearningGoalRow } from "@/lib/learning/server";
import { EmptyDashboard } from "./EmptyDashboard";
import { KpiSummary } from "./KpiSummary";
import { RecommendationCard } from "./RecommendationCard";
import { UpcomingExamCard } from "./UpcomingExamCard";
import {
  RecentFeedbackCard,
  type RecentFeedbackItem,
} from "./RecentFeedbackCard";
import { AlertsCard, type DashboardAlert } from "./AlertsCard";

type Props = {
  goal: LearningGoalRow;
  kpi: DashboardKpi;
  recentFeedbacks: RecentFeedbackItem[];
  alerts: DashboardAlert[];
};

export function DashboardContent({
  goal,
  kpi,
  recentFeedbacks,
  alerts,
}: Props) {
  const isEmpty =
    kpi.todayAttempts === 0 && kpi.totalAttempts === 0 && kpi.streakDays === 0;
  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <KpiSummary kpi={kpi} />
      {isEmpty ? (
        <EmptyDashboard />
      ) : (
        <>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={16}>
              <RecommendationCard
                title="이어 풀 문제"
                reason="최근 학습 흐름을 따라가는 추천이에요."
                ctaHref="/practice/recommendations"
              />
            </Col>
            <Col xs={24} md={8}>
              <UpcomingExamCard examDate={goal.exam_date} />
            </Col>
          </Row>
          {/* Phase 7-D Task 11 (P1-7) — RecentFeedback + Alerts */}
          <Row gutter={[16, 16]}>
            <Col xs={24} md={16}>
              <RecentFeedbackCard items={recentFeedbacks} />
            </Col>
            <Col xs={24} md={8}>
              <AlertsCard alerts={alerts} />
            </Col>
          </Row>
        </>
      )}
    </Space>
  );
}
