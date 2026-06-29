"use client";

import { useState } from "react";
import { Button, Empty, Table, Typography, theme } from "antd";
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
import { AppCard } from "@/components/shared/AppCard";
import { SPACING } from "@/theme/spacing";

const { Title } = Typography;

const DIMENSION_KEYS = [
  "grammar",
  "vocab",
  "structure",
  "content",
  "expression",
  "topic_fit",
  "language",
] as const;

const AXIS_FONT_SIZE = 12;
const CHART_MARGIN = {
  top: SPACING.sm,
  right: SPACING.sm,
  left: 0,
  bottom: SPACING.sm,
} as const;
const EMPTY_VALUE = "-";

export type ChartDatum = {
  dimension: string;
  previous: number | null;
  current: number | null;
};

type Props = {
  data: ChartDatum[];
  hasPrevious: boolean;
};

export function ScoreComparisonChart({ data, hasPrevious }: Props) {
  const t = useTranslations("reports.chart");
  const tDim = useTranslations("reports.dimensions");
  const { token } = theme.useToken();
  const [tableFallback, setTableFallback] = useState(false);

  const dimLabel = (code: string) =>
    (DIMENSION_KEYS as readonly string[]).includes(code)
      ? tDim(code as (typeof DIMENSION_KEYS)[number])
      : code;
  const fmt = (value: number | null) =>
    value === null ? EMPTY_VALUE : t("scorePoint", { value });

  if (data.length === 0) {
    return (
      <AppCard data-testid="comparison-chart">
        <Empty description={t("emptyChart")} />
      </AppCard>
    );
  }

  const chartData = data.map((item) => ({
    name: dimLabel(item.dimension),
    previous: item.previous,
    current: item.current,
  }));

  if (tableFallback) {
    return (
      <AppCard
        data-testid="comparison-chart"
        title={t("tableTitle")}
        extra={
          <Button
            size="small"
            type="link"
            onClick={() => setTableFallback(false)}
            data-testid="comparison-chart-view-chart"
          >
            {t("title")}
          </Button>
        }
      >
        <Table
          data-testid="comparison-chart-table"
          dataSource={data.map((item) => ({ key: item.dimension, ...item }))}
          pagination={false}
          size="small"
          columns={[
            {
              title: t("colDimension"),
              dataIndex: "dimension",
              render: (value: string) => dimLabel(value),
            },
            ...(hasPrevious
              ? [
                  {
                    title: t("seriesPrevious"),
                    dataIndex: "previous",
                    render: fmt,
                  },
                ]
              : []),
            { title: t("seriesCurrent"), dataIndex: "current", render: fmt },
          ]}
        />
      </AppCard>
    );
  }

  return (
    <AppCard data-testid="comparison-chart">
      <div className="flex w-full flex-wrap items-center justify-between gap-2">
        <Title level={5} className="mt-0">
          {t("title")}
        </Title>
        <Button
          size="small"
          type="link"
          onClick={() => setTableFallback(true)}
          data-testid="comparison-chart-view-table"
        >
          {t("viewAsTable")}
        </Button>
      </div>
      <div className="w-full overflow-x-auto">
        <div className="h-72 min-w-96">
          <ChartBody
            chartData={chartData}
            hasPrevious={hasPrevious}
            previousLabel={t("seriesPrevious")}
            currentLabel={t("seriesCurrent")}
            previousColor={token.colorTextQuaternary}
            currentColor={token.colorPrimary}
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
  previousColor,
  currentColor,
}: {
  chartData: {
    name: string;
    previous: number | null;
    current: number | null;
  }[];
  hasPrevious: boolean;
  previousLabel: string;
  currentLabel: string;
  previousColor: string;
  currentColor: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={CHART_MARGIN}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" fontSize={AXIS_FONT_SIZE} />
        <YAxis domain={[0, 100]} fontSize={AXIS_FONT_SIZE} />
        <Tooltip />
        <Legend />
        {hasPrevious ? (
          <Bar dataKey="previous" name={previousLabel} fill={previousColor} />
        ) : null}
        <Bar dataKey="current" name={currentLabel} fill={currentColor} />
      </BarChart>
    </ResponsiveContainer>
  );
}
