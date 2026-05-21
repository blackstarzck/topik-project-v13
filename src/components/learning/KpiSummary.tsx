import { Col, Row } from "antd";
import type { DashboardKpi } from "@/lib/learning/kpi";
import { KpiCard } from "./KpiCard";

type Props = {
  kpi: DashboardKpi;
};

export function KpiSummary({ kpi }: Props) {
  const examLabel =
    kpi.examDaysLeft === null
      ? "—"
      : kpi.examDaysLeft === 0
        ? "오늘"
        : `D-${kpi.examDaysLeft}`;
  return (
    <Row gutter={[16, 16]}>
      <Col xs={12} md={6}>
        <KpiCard title="오늘 시도" value={kpi.todayAttempts} suffix="회" />
      </Col>
      <Col xs={12} md={6}>
        <KpiCard title="누적 시도" value={kpi.totalAttempts} suffix="회" />
      </Col>
      <Col xs={12} md={6}>
        <KpiCard title="시험까지" value={examLabel} />
      </Col>
      <Col xs={12} md={6}>
        <KpiCard title="연속 학습일" value={kpi.streakDays} suffix="일" />
      </Col>
    </Row>
  );
}
