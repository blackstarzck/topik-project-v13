"use client";

import { Col, Empty, Row, Tag, Typography } from "antd";
import { useTranslations } from "next-intl";
import { SPACING } from "@/theme/spacing";

const { Text, Title } = Typography;

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
const SECTION_CLASS_NAME = "comparison-diff-panel min-w-0 pb-[62px]";

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
        <section
          data-testid="comparison-dimension-cards"
          className={SECTION_CLASS_NAME}
        >
          <Empty description={t("emptyCurrent")} />
        </section>
      );
    }
    return (
      <section
        data-testid="comparison-dimension-cards"
        className={SECTION_CLASS_NAME}
      >
        <Title
          level={5}
          className="!mb-[40px] !mt-0"
          data-testid="comparison-dimension-section-title"
        >
          {t("titleScores")}
        </Title>
        <Row gutter={[SPACING.md, SPACING.md]}>
          {entries.map(([dimension, score]) => (
            <Col key={dimension} xs={12} md={6}>
              <div
                className="min-w-0 py-1"
                data-testid="comparison-dimension-card"
              >
                <Text
                  type="secondary"
                  className="font-normal"
                  data-testid="comparison-dimension-label"
                >
                  {dimLabel(dimension)}
                </Text>
                <div className="mt-2">
                  <span
                    className="block text-heading font-semibold leading-none text-text"
                    data-testid="comparison-dimension-score-value"
                  >
                    {score === null
                      ? EMPTY_VALUE
                      : t("scorePoint", { value: score })}
                  </span>
                </div>
              </div>
            </Col>
          ))}
        </Row>
      </section>
    );
  }

  const sorted = Object.entries(deltas)
    .sort((a, b) => Math.abs(b[1] ?? 0) - Math.abs(a[1] ?? 0))
    .slice(0, MAX_CARDS);

  if (sorted.length === 0) {
    return (
      <section
        data-testid="comparison-dimension-cards"
        className={SECTION_CLASS_NAME}
      >
        <Empty description={t("emptyChange")} />
      </section>
    );
  }

  return (
    <section
      data-testid="comparison-dimension-cards"
      className={SECTION_CLASS_NAME}
    >
      <Title
        level={5}
        className="!mb-[40px] !mt-0"
        data-testid="comparison-dimension-section-title"
      >
        {t("titleChange")}
      </Title>
      <Row gutter={[SPACING.md, SPACING.md]}>
        {sorted.map(([dimension, delta]) => {
          const trend = trendOf(delta);
          return (
            <Col key={dimension} xs={12} md={6}>
              <div
                className="min-w-0 py-1"
                data-testid="comparison-dimension-card"
              >
                <Text
                  type="secondary"
                  className="font-normal"
                  data-testid="comparison-dimension-label"
                >
                  {dimLabel(dimension)}
                </Text>
                <div className="mt-1">
                  <Tag>
                    {trendLabel[trend]}
                    {delta !== null && delta !== 0
                      ? ` ${delta > 0 ? "+" : ""}${delta}`
                      : ""}
                  </Tag>
                </div>
              </div>
            </Col>
          );
        })}
      </Row>
    </section>
  );
}
