"use client";

import {
  Button,
  Card,
  Col,
  Empty,
  Row,
  Space,
  Statistic,
  Table,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminOrgOperationsCards } from "./AdminOrgOperationsCards";
import { AdminOrgPerUserTable } from "./AdminOrgPerUserTable";
import { AdminAuditLogDrawer } from "./AdminAuditLogDrawer";
import type {
  AdminOrgDashboardExtended,
  AdminOrgRecentEvent,
} from "./admin-rpc";
import { formatDateTime, shortId, summarizePayload } from "./format";

const { Title } = Typography;

type KpiCardProps = {
  title: string;
  value: number | string;
  suffix?: string;
  highlight?: boolean;
};

function KpiCard({ title, value, suffix, highlight }: KpiCardProps) {
  return (
    <Card size="small" style={{ height: "100%" }}>
      <Statistic
        title={title}
        value={value}
        suffix={suffix}
        valueStyle={highlight ? { color: "#1677ff" } : undefined}
      />
    </Card>
  );
}

type Props = {
  data: AdminOrgDashboardExtended;
  /** Server-side reload (router.refresh) for empty/retry. */
  onRetry?: () => void;
};

/**
 * X-08 — 기관 관리자 대시보드 본문.
 *
 * regions: KPI 현황 (2, 4 KPIs incl. 평균 점수) · 운영 카드 (3) · 사용자/과제
 * 테이블 (4) · 우측 상세 패널 (5, in the per-user table) · 최근 활동 + 감사 로그.
 *
 * NOTE: 과제 제출률(assignment-rate) KPI 는 assignments 기반 집계 RPC 가 아직
 * 없어 평균 점수(avg_writing_score)로 4번째 KPI 를 채운다. 제출률 KPI 는 후속
 * RPC 확장 대상(remaining)이다.
 */
export function AdminOrgKpiCards({ data, onRetry }: Props) {
  const router = useRouter();
  const [auditOpen, setAuditOpen] = useState(false);
  const refresh = onRetry ?? (() => router.refresh());
  const events = Array.isArray(data.recent_events) ? data.recent_events : [];

  const columns: ColumnsType<AdminOrgRecentEvent> = [
    { title: "이벤트", dataIndex: "event_type", key: "event_type", width: 200 },
    {
      title: "발생 시각",
      dataIndex: "occurred_at",
      key: "occurred_at",
      width: 200,
      render: (value: string) => (
        <span suppressHydrationWarning>{formatDateTime(value)}</span>
      ),
    },
    {
      title: "사용자",
      dataIndex: "user_id",
      key: "user_id",
      width: 120,
      render: (value: string | null) => (
        <span style={{ fontFamily: "monospace", fontSize: 12 }}>
          {shortId(value)}
        </span>
      ),
    },
    {
      title: "페이로드",
      dataIndex: "payload",
      key: "payload",
      render: (value: unknown) => (
        <span style={{ fontFamily: "monospace", fontSize: 12 }}>
          {summarizePayload(value)}
        </span>
      ),
    },
  ];

  // 예외 (region 2): 데이터 없음은 0 대신 온보딩 안내로 대체.
  const isEmpty =
    data.learner_count === 0 &&
    data.active_7d_count === 0 &&
    data.submissions_7d_count === 0 &&
    events.length === 0 &&
    data.per_user.length === 0;

  if (isEmpty) {
    return (
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <Empty description="아직 기관 학습 데이터가 없어요. 학습자가 가입하고 문제를 풀면 KPI와 활동이 채워집니다.">
          <Button onClick={refresh}>새로고침</Button>
        </Empty>
        <AdminOrgOperationsCards />
      </Space>
    );
  }

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <KpiCard title="전체 학습자" value={data.learner_count} suffix="명" />
        </Col>
        <Col xs={12} md={6}>
          <KpiCard
            title="최근 7일 활성"
            value={data.active_7d_count}
            suffix="명"
          />
        </Col>
        <Col xs={12} md={6}>
          <KpiCard
            title="최근 7일 제출"
            value={data.submissions_7d_count}
            suffix="건"
          />
        </Col>
        <Col xs={12} md={6}>
          <KpiCard
            title="평균 점수"
            value={data.avg_writing_score == null ? "—" : data.avg_writing_score}
            suffix={data.avg_writing_score == null ? "" : "점"}
            highlight
          />
        </Col>
      </Row>

      <AdminOrgOperationsCards />

      <AdminOrgPerUserTable rows={data.per_user} onRetry={refresh} />

      <Card size="small">
        <Space
          style={{ width: "100%", justifyContent: "space-between" }}
          align="center"
        >
          <Title level={5} style={{ margin: 0 }}>
            최근 학습 이벤트
          </Title>
          <Button size="small" onClick={() => setAuditOpen(true)}>
            관리자 변경 이력
          </Button>
        </Space>
        <div style={{ marginTop: 12 }}>
          {events.length > 0 ? (
            <Table<AdminOrgRecentEvent>
              rowKey={(record, index) =>
                `${record.event_type}-${record.occurred_at}-${index ?? 0}`
              }
              columns={columns}
              dataSource={events}
              pagination={{ pageSize: 10 }}
              size="small"
              scroll={{ x: 640 }}
            />
          ) : (
            <Empty description="아직 기관 활동 데이터가 없어요." />
          )}
        </div>
      </Card>

      <AdminAuditLogDrawer
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
        title="관리자 변경 이력"
      />
    </Space>
  );
}
