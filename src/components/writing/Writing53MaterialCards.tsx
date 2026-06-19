"use client";

import { useRef, useState, type RefObject } from "react";
import { Alert, Descriptions, Empty, Typography } from "antd";
import { useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppCard } from "@/components/shared/AppCard";
import type {
  NormalizedChart,
  NormalizedMaterialCard,
} from "@/lib/writing/problem-normalizer";

const { Text } = Typography;

const CHART_HEIGHT = 180;
const RADIAL_CHART_HEIGHT = 156;
const RADIAL_OUTER_RADIUS = 54;
const DONUT_INNER_RADIUS = 32;
const CARTESIAN_CHART_MARGIN = { top: 8, right: 8, bottom: 0, left: 0 };
const CARTESIAN_Y_AXIS_WIDTH = 42;
const CHART_GRID_COLOR = "#f0f0f0";
const CHART_COLORS = ["#1677ff", "#52c41a", "#faad14", "#13c2c2", "#ff4d4f"];
const TOOLTIP_MARK_OFFSET = 8;
const TOOLTIP_MAX_WIDTH = 184;
const TOOLTIP_BASE_HEIGHT = 54;
const TOOLTIP_MULTI_LINE_HEIGHT = 76;

type Props = {
  cards: NormalizedMaterialCard[];
};

type ChartValueRow = {
  id: string;
  label: string;
  markIndex: number;
  markKind: "bar" | "dot" | "sector";
  value: string | number;
  colorIndex: number | null;
  tooltipIndex: number;
};

type ChartTooltipPosition = {
  x: number;
  y: number;
};

type ChartHoverTarget = ChartValueRow & {
  position?: ChartTooltipPosition;
};

function axisLabels(chart: NormalizedChart): string[] {
  if (chart.yearRange.length > 0) return chart.yearRange.map(String);
  const maxLength = Math.max(
    0,
    ...chart.series.map((item) => item.values.length),
  );
  return Array.from({ length: maxLength }, (_, index) => String(index + 1));
}

function cartesianData(chart: NormalizedChart) {
  return axisLabels(chart).map((name, index) => {
    const row: Record<string, string | number | null> = { name };
    for (const item of chart.series) {
      row[item.label] = item.values[index] ?? null;
    }
    return row;
  });
}

function pieData(chart: NormalizedChart) {
  return chart.series.flatMap((item) => {
    const value = item.values.at(-1);
    return typeof value === "number" ? [{ name: item.label, value }] : [];
  });
}

function chartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}

function chartColorClass(index: number): string {
  return `writing-material-value-bullet--color-${index % CHART_COLORS.length}`;
}

function boundedTooltipIndex(index: number, labels: string[]) {
  return Math.min(index, Math.max(labels.length - 1, 0));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatSeriesValues(labels: string[], values: Array<number | null>) {
  return labels
    .map((label, index) => `${label} ${values[index] ?? "-"}`)
    .join(" · ");
}

function valueRows(chart: NormalizedChart): ChartValueRow[] {
  const labels = axisLabels(chart);
  const isRadial = chart.chartType === "pie" || chart.chartType === "donut";

  if (isRadial) {
    return pieData(chart).map((item, index) => ({
      id: `${item.name}-${index}`,
      label: item.name,
      markIndex: index,
      markKind: "sector",
      value: item.value,
      colorIndex: index,
      tooltipIndex: index,
    }));
  }

  if (chart.series.length === 1) {
    const [series] = chart.series;
    return labels.map((label, index) => ({
      id: `${series.label}-${label}`,
      label,
      markIndex: index,
      markKind: chart.chartType === "line" ? "dot" : "bar",
      value: series.values[index] ?? "-",
      colorIndex: null,
      tooltipIndex: index,
    }));
  }

  const dataCount = labels.length;
  return chart.series.map((item, index) => ({
    id: item.label,
    label: item.label,
    markIndex: index * dataCount,
    markKind: chart.chartType === "line" ? "dot" : "bar",
    value: formatSeriesValues(labels, item.values),
    colorIndex: index,
    tooltipIndex: boundedTooltipIndex(0, labels),
  }));
}

function markerSelector(markKind: ChartValueRow["markKind"]) {
  if (markKind === "sector") return ".recharts-pie-sector path";
  if (markKind === "dot") return ".recharts-line-dot";
  return ".recharts-bar-rectangle .recharts-rectangle:not(.recharts-tooltip-cursor)";
}

function estimatedTooltipWidth(row: ChartValueRow) {
  const contentLength = `${row.label} ${row.value}`.length;

  if (contentLength <= 8) return 64;
  if (contentLength <= 14) return 88;
  if (contentLength <= 22) return 120;
  return TOOLTIP_MAX_WIDTH;
}

function estimatedTooltipHeight(row: ChartValueRow) {
  return String(row.value).length > 18
    ? TOOLTIP_MULTI_LINE_HEIGHT
    : TOOLTIP_BASE_HEIGHT;
}

function resolveTooltipPosition(
  chartElement: HTMLDivElement | null,
  row: ChartValueRow,
): ChartTooltipPosition | undefined {
  const chartRoot =
    chartElement?.querySelector<HTMLElement>(".recharts-wrapper") ??
    chartElement;
  if (!chartRoot) return undefined;

  const marks = Array.from(
    chartRoot.querySelectorAll<SVGGraphicsElement>(
      markerSelector(row.markKind),
    ),
  );
  const mark = marks[row.markIndex] ?? marks[0];
  if (!mark) return undefined;

  const chartRect = chartRoot.getBoundingClientRect();
  const markRect = mark.getBoundingClientRect();
  const targetX = markRect.left - chartRect.left + markRect.width / 2;
  const targetY =
    row.markKind === "bar"
      ? markRect.top - chartRect.top
      : markRect.top - chartRect.top + markRect.height / 2;

  const tooltipWidth = estimatedTooltipWidth(row);
  const tooltipHeight = estimatedTooltipHeight(row);
  const maxX = Math.max(0, chartRect.width - tooltipWidth);
  const maxY = Math.max(0, chartRect.height - tooltipHeight);
  const prefersRight =
    targetX + TOOLTIP_MARK_OFFSET + tooltipWidth <= chartRect.width;
  const rawX = prefersRight
    ? targetX + TOOLTIP_MARK_OFFSET
    : targetX - tooltipWidth - TOOLTIP_MARK_OFFSET;
  const aboveY = targetY - tooltipHeight - TOOLTIP_MARK_OFFSET;
  const centeredY = targetY - tooltipHeight / 2;
  const rawY =
    row.markKind === "bar"
      ? aboveY >= 0
        ? aboveY
        : targetY + TOOLTIP_MARK_OFFSET
      : centeredY;

  return {
    x: clamp(rawX, 0, maxX),
    y: clamp(rawY, 0, maxY),
  };
}

function ChartValueList({
  activeRowId,
  chart,
  onActiveRowChange,
}: {
  activeRowId: string | null;
  chart: NormalizedChart;
  onActiveRowChange: (target: ChartValueRow | null) => void;
}) {
  const rows = valueRows(chart);

  return (
    <div
      className="writing-material-value-list"
      data-testid="q53-material-value-list"
    >
      <dl className="writing-material-value-list__items">
        {rows.map((row) => {
          const isActive = activeRowId === row.id;
          return (
            <div
              aria-label={`${row.label} ${row.value}`}
              className={[
                "writing-material-value-list__row",
                isActive ? "writing-material-value-list__row--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              data-testid="q53-material-value-row"
              key={row.id}
              onBlur={() => onActiveRowChange(null)}
              onFocus={() => onActiveRowChange(row)}
              onMouseEnter={() => onActiveRowChange(row)}
              onMouseLeave={() => onActiveRowChange(null)}
              tabIndex={0}
            >
              <dt className="writing-material-value-list__label">
                {row.colorIndex !== null ? (
                  <span
                    aria-hidden
                    className={[
                      "writing-material-value-list__bullet",
                      chartColorClass(row.colorIndex),
                    ].join(" ")}
                    data-color={chartColor(row.colorIndex)}
                    data-testid="q53-material-value-bullet"
                  />
                ) : null}
                <span>{row.label}</span>
              </dt>
              <dd className="writing-material-value-list__value">
                {row.value}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

function ChartValueTooltipContent({
  active,
  target,
}: {
  active?: boolean;
  target: ChartHoverTarget;
}) {
  if (!active) return null;

  return (
    <div className="writing-material-chart-tooltip">
      <p className="writing-material-chart-tooltip__label">{target.label}</p>
      <p className="writing-material-chart-tooltip__value">
        {target.colorIndex !== null ? (
          <span
            aria-hidden
            className={[
              "writing-material-value-list__bullet",
              chartColorClass(target.colorIndex),
            ].join(" ")}
          />
        ) : null}
        <span>{target.value}</span>
      </p>
    </div>
  );
}

function ChartTooltip({
  activeValueRow,
}: {
  activeValueRow: ChartHoverTarget | null;
}) {
  return (
    <Tooltip
      active={activeValueRow ? true : undefined}
      content={
        activeValueRow ? (
          <ChartValueTooltipContent target={activeValueRow} />
        ) : undefined
      }
      defaultIndex={activeValueRow?.tooltipIndex}
      isAnimationActive={false}
      key={activeValueRow ? `value-row-${activeValueRow.id}` : "idle"}
      position={activeValueRow?.position}
    />
  );
}

function ChartVisual({
  activeValueRow,
  chart,
  chartRef,
}: {
  activeValueRow: ChartHoverTarget | null;
  chart: NormalizedChart;
  chartRef: RefObject<HTMLDivElement | null>;
}) {
  if (
    chart.series.length === 0 ||
    chart.chartType === "unknown" ||
    chart.chartType === "table"
  ) {
    return null;
  }

  if (chart.chartType === "pie" || chart.chartType === "donut") {
    const data = pieData(chart);
    if (data.length === 0) return null;
    return (
      <div
        className="writing-material-chart writing-material-chart--radial"
        aria-label={chart.title}
        data-testid="q53-material-chart"
        ref={chartRef}
      >
        <ResponsiveContainer width="100%" height={RADIAL_CHART_HEIGHT}>
          <PieChart>
            <ChartTooltip activeValueRow={activeValueRow} />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={chart.chartType === "donut" ? DONUT_INNER_RADIUS : 0}
              outerRadius={RADIAL_OUTER_RADIUS}
              paddingAngle={chart.chartType === "donut" ? 3 : 1}
              startAngle={90}
              endAngle={450}
              isAnimationActive={false}
            >
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={chartColor(index)} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const data = cartesianData(chart);
  if (data.length === 0) return null;

  if (chart.chartType === "line") {
    return (
      <div
        className="writing-material-chart writing-material-chart--cartesian"
        aria-label={chart.title}
        data-testid="q53-material-chart"
        ref={chartRef}
      >
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <LineChart data={data} margin={CARTESIAN_CHART_MARGIN}>
            <CartesianGrid stroke={CHART_GRID_COLOR} strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis width={CARTESIAN_Y_AXIS_WIDTH} tickMargin={4} />
            <ChartTooltip activeValueRow={activeValueRow} />
            {chart.series.map((item, index) => (
              <Line
                key={item.label}
                type="monotone"
                dataKey={item.label}
                stroke={chartColor(index)}
                strokeWidth={2}
                dot={{ fill: chartColor(index), r: 3 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div
      className="writing-material-chart writing-material-chart--cartesian"
      aria-label={chart.title}
      data-testid="q53-material-chart"
      ref={chartRef}
    >
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <BarChart data={data} margin={CARTESIAN_CHART_MARGIN}>
          <CartesianGrid stroke={CHART_GRID_COLOR} strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis width={CARTESIAN_Y_AXIS_WIDTH} tickMargin={4} />
          <ChartTooltip activeValueRow={activeValueRow} />
          {chart.series.map((item, index) => (
            <Bar
              key={item.label}
              dataKey={item.label}
              fill={chartColor(index)}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CardBody({ card }: { card: NormalizedMaterialCard }) {
  const t = useTranslations("writing.q53");
  const chartRef = useRef<HTMLDivElement | null>(null);
  const [activeValueRow, setActiveValueRow] = useState<ChartHoverTarget | null>(
    null,
  );
  const handleActiveRowChange = (row: ChartValueRow | null) => {
    setActiveValueRow(
      row
        ? {
            ...row,
            position: resolveTooltipPosition(chartRef.current, row),
          }
        : null,
    );
  };

  if (card.kind === "reference") {
    return (
      <Descriptions
        bordered
        size="small"
        column={1}
        className="writing-material-card__description"
        items={card.rows.map((row) => ({
          key: row.label,
          label: row.label,
          children: row.value,
        }))}
      />
    );
  }

  return (
    <div className="writing-material-chart-stack">
      {card.warning ? (
        <Alert type="warning" showIcon title={t("materialChartFallback")} />
      ) : null}
      <ChartVisual
        activeValueRow={activeValueRow}
        chart={card.chart}
        chartRef={chartRef}
      />
      <ChartValueList
        activeRowId={activeValueRow?.id ?? null}
        chart={card.chart}
        onActiveRowChange={handleActiveRowChange}
      />
    </div>
  );
}

export function Writing53MaterialCards({ cards }: Props) {
  const t = useTranslations("writing.q53");
  const visibleCards = [
    ...cards.filter((card) => card.kind === "chart"),
    ...cards.filter((card) => card.kind === "reference"),
  ].slice(0, 3);
  const chartCount = visibleCards.filter(
    (card) => card.kind === "chart",
  ).length;

  return (
    <AppCard
      size="small"
      className="writing-material-card"
      title={t("materialsTitle")}
      data-testid="q53-material-cards"
    >
      {visibleCards.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t("materialsEmpty")}
        />
      ) : (
        <div className="writing-material-card__grid">
          {visibleCards.map((card) => {
            const isReference = card.kind === "reference";
            const shouldSpanRow = isReference && chartCount < 3;

            return (
              <div
                key={card.id}
                className={[
                  "writing-material-card__cell",
                  isReference
                    ? "writing-material-card__cell--reference"
                    : "writing-material-card__cell--chart",
                  shouldSpanRow ? "writing-material-card__cell--span-row" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                data-testid="q53-material-grid-cell"
              >
                {isReference ? (
                  <div
                    className="writing-material-card__reference"
                    data-testid="q53-material-reference"
                  >
                    <CardBody card={card} />
                  </div>
                ) : (
                  <section
                    className="writing-material-card__body"
                    data-testid="q53-material-data-card"
                  >
                    <div className="writing-material-card__heading">
                      <Text strong title={card.title}>
                        {card.title}
                      </Text>
                      {card.subtitle ? (
                        <Text type="secondary" title={card.subtitle}>
                          {card.subtitle}
                        </Text>
                      ) : null}
                    </div>
                    <CardBody card={card} />
                  </section>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AppCard>
  );
}
