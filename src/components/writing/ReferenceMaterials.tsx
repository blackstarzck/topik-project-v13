"use client";

import { useState } from "react";
import { Empty, Image, Space, Typography } from "antd";
import { useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppCard } from "@/components/shared/AppCard";
import type {
  NormalizedChart,
  NormalizedReferenceMaterial,
} from "@/lib/writing/problem-normalizer";

const { Text } = Typography;
const CHART_COLORS = ["#1677ff", "#52c41a", "#faad14", "#eb2f96", "#722ed1"];

export type ProblemAsset = {
  id: string;
  url: string;
  assetType: "image" | "audio";
  /** 대체 텍스트 폴백 + 디버깅용 경로. */
  storagePath: string;
};

type Props = {
  assets: ProblemAsset[];
  materials?: NormalizedReferenceMaterial[];
  /** 캡션(40자 이하) — 없으면 표시 안 함. */
  captions?: Record<string, string>;
};

/**
 * D-01..D-04 §3 참고 이미지/자료 영역.
 * - 이미지: antd <Image> preview 로 확대 보기 지원, 비율 유지.
 * - 로드 실패: 대체 텍스트 + 빈 프레임(§3 예외).
 * - 자료 없음: 접힌 빈 상태(§3 예외)를 caller 가 조건부로 렌더(빈 배열이면 null).
 * - 오디오: <audio> controls (준비된 자료가 있을 때만).
 */
export function ReferenceMaterials({
  assets,
  materials = [],
  captions,
}: Props) {
  const t = useTranslations("writing.reference");
  if (assets.length === 0 && materials.length === 0) return null;

  return (
    <AppCard size="small" title={t("cardTitle")}>
      <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
        {materials.map((material) => (
          <MaterialView key={material.id} material={material} />
        ))}
        {assets.map((asset) => (
          <AssetView
            key={asset.id}
            asset={asset}
            caption={captions?.[asset.id]}
          />
        ))}
      </Space>
    </AppCard>
  );
}

function MaterialView({ material }: { material: NormalizedReferenceMaterial }) {
  if (material.kind === "chart") {
    return (
      <div>
        <Text strong>{material.title}</Text>
        <ChartView chart={material.chart} />
      </div>
    );
  }
  if (material.kind === "note") {
    return (
      <div>
        <Text strong>{material.title}</Text>
        <dl style={{ display: "grid", gap: 4, margin: "8px 0 0" }}>
          {material.rows.map((row) => (
            <div
              key={`${row.label}-${row.value}`}
              style={{ display: "grid", gridTemplateColumns: "96px 1fr", gap: 8 }}
            >
              <dt>
                <Text type="secondary">{row.label}</Text>
              </dt>
              <dd style={{ margin: 0 }}>{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  }
  return (
    <div>
      <Text strong>{material.title}</Text>
      <Text style={{ display: "block", whiteSpace: "pre-line" }}>
        {material.text}
      </Text>
    </div>
  );
}

function chartRows(chart: NormalizedChart): Array<Record<string, unknown>> {
  if (chart.chartType === "pie" || chart.chartType === "donut") {
    return chart.series.map((series) => ({
      name: series.label,
      value: series.values[0] ?? 0,
    }));
  }
  const length = Math.max(
    chart.yearRange.length,
    ...chart.series.map((series) => series.values.length),
  );
  return Array.from({ length }, (_, index) => {
    const row: Record<string, unknown> = {
      name: String(chart.yearRange[index] ?? index + 1),
    };
    for (const series of chart.series) {
      row[series.label] = series.values[index] ?? null;
    }
    return row;
  });
}

function ChartView({ chart }: { chart: NormalizedChart }) {
  const t = useTranslations("writing.reference");
  const rows = chartRows(chart);
  if (rows.length === 0) return null;
  const suffix = chart.unit ? ` (${chart.unit})` : "";
  const caption = [
    chart.surveyOrg,
    chart.unit ? t("unitLabel", { unit: chart.unit }) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  if (chart.chartType === "pie" || chart.chartType === "donut") {
    return (
      <div style={{ width: "100%" }}>
        <div style={{ width: "100%", height: 240 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={rows}
                dataKey="value"
                nameKey="name"
                innerRadius={chart.chartType === "donut" ? 48 : 0}
                outerRadius={86}
                label
              >
                {rows.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                  />
                ))}
              </Pie>
              <RechartsTooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {caption ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {caption}
          </Text>
        ) : null}
      </div>
    );
  }

  if (chart.chartType === "line") {
    return (
      <div style={{ width: "100%" }}>
        <div style={{ width: "100%", height: 240 }}>
          <ResponsiveContainer>
            <LineChart data={rows}>
              <XAxis dataKey="name" />
              <YAxis />
              <RechartsTooltip />
              <Legend />
              {chart.series.map((series, index) => (
                <Line
                  key={series.label}
                  dataKey={series.label}
                  name={`${series.label}${suffix}`}
                  stroke={CHART_COLORS[index % CHART_COLORS.length]}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        {caption ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {caption}
          </Text>
        ) : null}
      </div>
    );
  }

  return (
    <div style={{ width: "100%" }}>
      <div style={{ width: "100%", height: 240 }}>
        <ResponsiveContainer>
          <BarChart data={rows}>
            <XAxis dataKey="name" />
            <YAxis />
            <RechartsTooltip />
            <Legend />
            {chart.series.map((series, index) => (
              <Bar
                key={series.label}
                dataKey={series.label}
                name={`${series.label}${suffix}`}
                fill={CHART_COLORS[index % CHART_COLORS.length]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {caption ? (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {caption}
        </Text>
      ) : null}
    </div>
  );
}

function AssetView({
  asset,
  caption,
}: {
  asset: ProblemAsset;
  caption?: string;
}) {
  const t = useTranslations("writing.reference");
  const [failed, setFailed] = useState(false);
  // 캡션이 있으면 alt 로 사용(40자 제한), 없으면 유형별 기본 대체 텍스트.
  const alt =
    caption && caption.length > 0
      ? caption.slice(0, 40)
      : asset.assetType === "image"
        ? t("altImage")
        : t("altAudio");

  if (asset.assetType === "audio") {
    return (
      <div>
        <audio controls src={asset.url} aria-label={alt} style={{ width: "100%" }}>
          <track kind="captions" />
        </audio>
        {caption ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {caption.slice(0, 40)}
          </Text>
        ) : null}
      </div>
    );
  }

  if (failed) {
    // §3 예외 — 이미지 로드 실패 시 대체 텍스트 + 빈 프레임.
    return (
      <div
        style={{
          border: "1px dashed #d9d9d9",
          borderRadius: 8,
          padding: 16,
        }}
      >
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t("imageLoadFailed", { alt })}
        />
      </div>
    );
  }

  return (
    <div>
      <Image
        src={asset.url}
        alt={alt}
        style={{ maxWidth: "100%", height: "auto" }}
        onError={() => setFailed(true)}
        preview={{ mask: t("zoom") }}
      />
      {caption ? (
        <Text type="secondary" style={{ display: "block", fontSize: 12 }}>
          {caption.slice(0, 40)}
        </Text>
      ) : null}
    </div>
  );
}
