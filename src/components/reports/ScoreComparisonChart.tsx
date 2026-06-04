"use client";

import { useState } from "react";
import { Button, Empty, Space, Table, Typography } from "antd";
import { AppCard } from "@/components/shared/AppCard";
import { useTranslations } from "next-intl";
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

// dimension 코드 → reports.dimensions 카탈로그 키. 라벨 문구는 t()로 해석한다.
const DIMENSION_KEYS = [
  "grammar",
  "vocab",
  "structure",
  "content",
  "expression",
  "topic_fit",
] as const;

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
  const t = useTranslations("reports.chart");
  const tDim = useTranslations("reports.dimensions");
  const [tableFallback, setTableFallback] = useState(false);

  // dimension 코드를 카탈로그 라벨로. 알 수 없는 코드는 코드 그대로 폴백.
  const dimLabel = (code: string) =>
    (DIMENSION_KEYS as readonly string[]).includes(code)
      ? tDim(code as (typeof DIMENSION_KEYS)[number])
      : code;
  // 점수 포맷("{value}점"). null이면 대시.
  const fmt = (v: number | null) =>
    v === null ? "—" : t("scorePoint", { value: v });

  if (data.length === 0) {
    return (
      <AppCard>
        <Empty description={t("emptyChart")} />
      </AppCard>
    );
  }

  const chartData = data.map((d) => ({
    name: dimLabel(d.dimension),
    previous: d.previous,
    current: d.current,
  }));

  if (tableFallback) {
    return (
      <AppCard>
        <Title level={5} style={{ marginTop: 0 }}>
          {t("tableTitle")}
        </Title>
        <Table
          dataSource={data.map((d) => ({ key: d.dimension, ...d }))}
          pagination={false}
          size="small"
          columns={[
            {
              title: t("colDimension"),
              dataIndex: "dimension",
              render: (v: string) => dimLabel(v),
            },
            ...(hasPrevious
              ? [{ title: t("seriesPrevious"), dataIndex: "previous", render: fmt }]
              : []),
            { title: t("seriesCurrent"), dataIndex: "current", render: fmt },
          ]}
        />
      </AppCard>
    );
  }

  return (
    <AppCard>
      <Space style={{ width: "100%", justifyContent: "space-between" }}>
        <Title level={5} style={{ marginTop: 0 }}>
          {t("title")}
        </Title>
        <Button size="small" type="link" onClick={() => setTableFallback(true)}>
          {t("viewAsTable")}
        </Button>
      </Space>
      {/* 모바일 가로 스크롤 대비 최소 너비 확보. */}
      <div style={{ width: "100%", overflowX: "auto" }}>
        <div style={{ minWidth: 360, height: 280 }}>
          <ChartBody
            chartData={chartData}
            hasPrevious={hasPrevious}
            previousLabel={t("seriesPrevious")}
            currentLabel={t("seriesCurrent")}
          />
        </div>
      </div>
    </AppCard>
  );
}

function ChartBody({
  chartData,
  hasPrevious,
  previousLabel,
  currentLabel,
}: {
  chartData: { name: string; previous: number | null; current: number | null }[];
  hasPrevious: boolean;
  previousLabel: string;
  currentLabel: string;
}) {
  // JSX를 try/catch로 감싸도 React는 렌더를 지연 처리해 실제 렌더 오류를 잡지
  // 못한다. 차트 렌더 실패 시 복구 경로는 위의 '표로 보기'(tableFallback)이며,
  // 그래서 여기서는 차트만 반환한다. dataKey는 안정적 영문 키로 두고, 범례
  // 라벨은 name 프로퍼티로 해석한 문구를 전달한다.
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" fontSize={12} />
        <YAxis domain={[0, 100]} fontSize={12} />
        <Tooltip />
        <Legend />
        {hasPrevious ? (
          <Bar dataKey="previous" name={previousLabel} fill="#bfbfbf" />
        ) : null}
        <Bar dataKey="current" name={currentLabel} fill="#1677ff" />
      </BarChart>
    </ResponsiveContainer>
  );
}
