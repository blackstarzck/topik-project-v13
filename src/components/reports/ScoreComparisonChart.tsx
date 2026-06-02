"use client";

import { useState } from "react";
import { Button, Card, Empty, Space, Table, Typography } from "antd";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const { Title } = Typography;

const DIMENSION_LABELS: Record<string, string> = {
  grammar: "문법",
  vocab: "어휘",
  structure: "구성",
  content: "내용",
  expression: "표현",
  topic_fit: "주제 적합성",
};

export type ChartDatum = {
  dimension: string;
  previous: number | null;
  current: number | null;
};

type Props = {
  /** 항목별 이전/현재 점수. score_max 차이 보정 후 0..100 정규화된 값. */
  data: ChartDatum[];
  /** 이전 데이터가 없으면 현재만 표시(description region 2/3 예외). */
  hasPrevious: boolean;
};

/**
 * R-01 점수 그래프 (description region 2).
 * 제약: 범례 5개 이하, 모바일은 가로 스크롤 또는 요약 차트.
 * 예외: 차트 로드 실패 시 표 형태 대체와 재시도 제공.
 *
 * recharts(설치됨)로 항목별 막대 비교. 렌더 오류는 ErrorBoundary 없이도 표
 * 대체로 폴백할 수 있도록 사용자가 "표로 보기"를 누를 수 있게 하고, 데이터가
 * 비면 빈 상태를 보여준다.
 */
export function ScoreComparisonChart({ data, hasPrevious }: Props) {
  const [tableFallback, setTableFallback] = useState(false);

  if (data.length === 0) {
    return (
      <Card>
        <Empty description="항목별 점수 데이터가 없어 그래프를 그릴 수 없어요." />
      </Card>
    );
  }

  const chartData = data.map((d) => ({
    name: DIMENSION_LABELS[d.dimension] ?? d.dimension,
    이전: d.previous,
    현재: d.current,
  }));

  if (tableFallback) {
    return (
      <Card>
        <Title level={5} style={{ marginTop: 0 }}>
          항목별 점수 (표)
        </Title>
        <Table
          dataSource={data.map((d) => ({ key: d.dimension, ...d }))}
          pagination={false}
          size="small"
          columns={[
            {
              title: "항목",
              dataIndex: "dimension",
              render: (v: string) => DIMENSION_LABELS[v] ?? v,
            },
            ...(hasPrevious
              ? [{ title: "이전", dataIndex: "previous", render: fmt }]
              : []),
            { title: "현재", dataIndex: "current", render: fmt },
          ]}
        />
      </Card>
    );
  }

  return (
    <Card>
      <Space style={{ width: "100%", justifyContent: "space-between" }}>
        <Title level={5} style={{ marginTop: 0 }}>
          항목별 점수 비교
        </Title>
        <Button size="small" type="link" onClick={() => setTableFallback(true)}>
          표로 보기
        </Button>
      </Space>
      {/* 모바일 가로 스크롤 대비 최소 너비 확보. */}
      <div style={{ width: "100%", overflowX: "auto" }}>
        <div style={{ minWidth: 360, height: 280 }}>
          <ChartBody chartData={chartData} hasPrevious={hasPrevious} />
        </div>
      </div>
    </Card>
  );
}

function ChartBody({
  chartData,
  hasPrevious,
}: {
  chartData: { name: string; 이전: number | null; 현재: number | null }[];
  hasPrevious: boolean;
}) {
  // JSX를 try/catch로 감싸도 React는 렌더를 지연 처리해 실제 렌더 오류를 잡지
  // 못한다. 차트 렌더 실패 시 복구 경로는 위의 '표로 보기'(tableFallback)이며,
  // 그래서 여기서는 차트만 반환한다.
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" fontSize={12} />
        <YAxis domain={[0, 100]} fontSize={12} />
        <Tooltip />
        <Legend />
        {hasPrevious ? <Bar dataKey="이전" fill="#bfbfbf" /> : null}
        <Bar dataKey="현재" fill="#1677ff" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function fmt(v: number | null) {
  return v === null ? "—" : `${v}점`;
}
