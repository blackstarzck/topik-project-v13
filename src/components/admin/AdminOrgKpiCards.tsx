"use client";

import { Card, Col, Empty, Row, Space, Statistic, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { AdminOrgOperationsCards } from "./AdminOrgOperationsCards";

const { Title } = Typography;

type KpiCardProps = {
  title: string;
  value: number | string;
  suffix?: string;
};

function KpiCard({ title, value, suffix }: KpiCardProps) {
  return (
    <Card size="small" style={{ height: "100%" }}>
      <Statistic title={title} value={value} suffix={suffix} />
    </Card>
  );
}

type AdminRecentEvent = {
  event_type: string;
  occurred_at: string;
  user_id: string | null;
  payload: unknown;
};

type AdminOrgDashboardData = {
  learner_count: number;
  active_7d_count: number;
  submissions_7d_count: number;
  recent_events: AdminRecentEvent[];
};

type Props = {
  data: AdminOrgDashboardData;
};

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR");
  } catch {
    return iso;
  }
}

/**
 * region 5 "민감 정보 마스킹": audit/event payload may carry free-form fields.
 * We do NOT dump the raw JSON (could leak emails, answers, tokens). Instead we
 * show only the safe top-level key names so an admin can see the shape without
 * exposing values.
 */
function summarizePayload(payload: unknown): string {
  if (payload == null || typeof payload !== "object") return "—";
  const keys = Object.keys(payload as Record<string, unknown>);
  if (keys.length === 0) return "—";
  const shown = keys.slice(0, 4).join(", ");
  return keys.length > 4 ? `${shown}, …` : shown;
}

export function AdminOrgKpiCards({ data }: Props) {
  const events = Array.isArray(data.recent_events) ? data.recent_events : [];

  const columns: ColumnsType<AdminRecentEvent> = [
    {
      title: "이벤트",
      dataIndex: "event_type",
      key: "event_type",
      width: 200,
    },
    {
      title: "발생 시각",
      dataIndex: "occurred_at",
      key: "occurred_at",
      width: 200,
      // suppressHydrationWarning: toLocaleString('ko-KR') can differ between the
      // server render and the client (locale/timezone) → React #418. The text
      // is informational, so suppress the mismatch warning rather than block.
      render: (value: string) => (
        <span suppressHydrationWarning>{formatDateTime(value)}</span>
      ),
    },
    {
      title: "사용자",
      dataIndex: "user_id",
      key: "user_id",
      width: 120,
      render: (value: string | null) =>
        value ? (
          <span style={{ fontFamily: "monospace", fontSize: 12 }}>
            {value.slice(0, 8)}…
          </span>
        ) : (
          "—"
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

  const hasAnyActivity =
    data.learner_count > 0 ||
    data.active_7d_count > 0 ||
    data.submissions_7d_count > 0 ||
    events.length > 0;

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <KpiCard
            title="전체 학습자"
            value={data.learner_count}
            suffix="명"
          />
        </Col>
        <Col xs={24} md={8}>
          <KpiCard
            title="최근 7일 활성"
            value={data.active_7d_count}
            suffix="명"
          />
        </Col>
        <Col xs={24} md={8}>
          <KpiCard
            title="최근 7일 제출"
            value={data.submissions_7d_count}
            suffix="건"
          />
        </Col>
      </Row>

      <AdminOrgOperationsCards />

      <Card size="small">
        <Title level={5} style={{ marginTop: 0 }}>
          최근 학습 이벤트
        </Title>
        {hasAnyActivity ? (
          <Table<AdminRecentEvent>
            rowKey={(record, index) =>
              `${record.event_type}-${record.occurred_at}-${index ?? 0}`
            }
            columns={columns}
            dataSource={events}
            pagination={{ pageSize: 10 }}
            size="small"
          />
        ) : (
          <Empty
            description="아직 기관 활동 데이터가 없어요. 학습자가 문제를 풀면 여기에 활동이 표시됩니다."
            style={{ padding: "2rem 1rem" }}
          />
        )}
      </Card>
    </Space>
  );
}
