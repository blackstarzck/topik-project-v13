"use client";

import { Card, Empty, Table, Typography } from "antd";
import type { ComparisonMetrics } from "@/lib/writing/comparison-service";

const { Title } = Typography;

type Props = { metrics: ComparisonMetrics };

type Row = { key: string; label: string; value: string };

export function MetricsTable({ metrics }: Props) {
  if (metrics.no_previous) {
    return (
      <Card>
        <Empty description="이전 제출이 없어 비교 항목이 없습니다." />
      </Card>
    );
  }
  const rows: Row[] = [
    {
      key: "score",
      label: "총점 변화",
      value: formatDelta(metrics.score_delta),
    },
    {
      key: "char",
      label: "글자 수 변화",
      value: formatDelta(metrics.char_delta),
    },
    ...Object.entries(metrics.dimension_deltas).map(([k, v]) => ({
      key: `dim-${k}`,
      label: `${k} 차원 변화`,
      value: formatDelta(v),
    })),
  ];
  return (
    <Card>
      <Title level={5} style={{ marginTop: 0 }}>비교 지표</Title>
      <Table
        dataSource={rows}
        rowKey="key"
        pagination={false}
        size="small"
        columns={[
          { title: "항목", dataIndex: "label" },
          { title: "변화", dataIndex: "value" },
        ]}
      />
    </Card>
  );
}

function formatDelta(n: number | null): string {
  if (n === null) return "—";
  if (n === 0) return "0";
  return n > 0 ? `+${n}` : `${n}`;
}
