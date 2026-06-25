"use client";

import { Col, Empty, Row, Tag, Typography } from "antd";
import { useTranslations } from "next-intl";
import { AppCard } from "@/components/shared/AppCard";
import { SPACING } from "@/theme/spacing";

const { Text } = Typography;

const DIMENSION_KEYS = [
  "grammar",
  "vocab",
  "structure",
  "content",
  "expression",
  "topic_fit",
  "language",
] as const;

const MAX_CARDS = 4;
const HOLD_THRESHOLD = 1;
const EMPTY_VALUE = "-";

type Props = {
  deltas: Record<string, number | null>;
  hasPrevious: boolean;
  currentScores?: Record<string, number | null>;
};

type Trend = "up" | "down" | "hold";

function trendOf(delta: number | null): Trend {
  if (delta === null) return "hold";
  if (delta >= HOLD_THRESHOLD) return "up";
  if (delta <= -HOLD_THRESHOLD) return "down";
  return "hold";
}

export function DimensionComparisonCards({
  deltas,
  hasPrevious,
  currentScores,
}: Props) {
  const t = useTranslations("reports.cards");
  const tDim = useTranslations("reports.dimensions");

  const dimLabel = (code: string) =>
    (DIMENSION_KEYS as readonly string[]).includes(code)
      ? tDim(code as (typeof DIMENSION_KEYS)[number])
      : code;
  const trendLabel: Record<Trend, string> = {
    up: t("trendUp"),
    down: t("trendDown"),
    hold: t("trendHold"),
  };

  if (!hasPrevious) {
    const entries = Object.entries(currentScores ?? {}).slice(0, MAX_CARDS);
    if (entries.length === 0) {
      return (
        <AppCard data-testid="comparison-dimension-cards">
          <Empty description={t("emptyCurrent")} />
        </AppCard>
      );
    }
    return (
      <AppCard
        title={t("titleScores")}
        data-testid="comparison-dimension-cards"
      >
        <Row gutter={[SPACING.md, SPACING.md]}>
          {entries.map(([dimension, score]) => (
            <Col key={dimension} xs={12} md={6}>
              <AppCard size="small" data-testid="comparison-dimension-card">
                <Text strong>{dimLabel(dimension)}</Text>
                <div className="mt-1">
                  <Tag>
                    {score === null
                      ? EMPTY_VALUE
                      : t("scorePoint", { value: score })}
                  </Tag>
                </div>
              </AppCard>
            </Col>
          ))}
        </Row>
      </AppCard>
    );
  }

  const sorted = Object.entries(deltas)
    .sort((a, b) => Math.abs(b[1] ?? 0) - Math.abs(a[1] ?? 0))
    .slice(0, MAX_CARDS);

  if (sorted.length === 0) {
    return (
      <AppCard data-testid="comparison-dimension-cards">
        <Empty description={t("emptyChange")} />
      </AppCard>
    );
  }

  return (
    <AppCard title={t("titleChange")} data-testid="comparison-dimension-cards">
      <Row gutter={[SPACING.md, SPACING.md]}>
        {sorted.map(([dimension, delta]) => {
          const trend = trendOf(delta);
          return (
            <Col key={dimension} xs={12} md={6}>
              <AppCard size="small" data-testid="comparison-dimension-card">
                <Text strong>{dimLabel(dimension)}</Text>
                <div className="mt-1">
                  <Tag>
                    {trendLabel[trend]}
                    {delta !== null && delta !== 0
                      ? ` ${delta > 0 ? "+" : ""}${delta}`
                      : ""}
                  </Tag>
                </div>
              </AppCard>
            </Col>
          );
        })}
      </Row>
    </AppCard>
  );
}
