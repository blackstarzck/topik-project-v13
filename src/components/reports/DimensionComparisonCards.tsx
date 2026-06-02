"use client";

import { Card, Col, Empty, Row, Tag, Typography } from "antd";
import { useTranslations } from "next-intl";

const { Text } = Typography;

// dimension 코드 → reports.dimensions 카탈로그 키. 라벨 문구는 t()로 해석한다.
const DIMENSION_KEYS = [
  "grammar",
  "vocab",
  "structure",
  "content",
  "expression",
  "topic_fit",
] as const;

const MAX_CARDS = 4;
/** 변화로 인정할 최소 점수 차 — 그 미만은 '유지'. */
const HOLD_THRESHOLD = 1;

type Props = {
  /** dimension → delta(현재-이전). null이면 이전 데이터 없음. */
  deltas: Record<string, number | null>;
  /** 이전 데이터가 없으면 현재 점수 카드만 표시(description region 3 예외). */
  hasPrevious: boolean;
  /** 이전 데이터 없을 때 보여줄 현재 점수 맵(0..100 정규화). */
  currentScores?: Record<string, number | null>;
};

type Trend = "up" | "down" | "hold";

function trendOf(delta: number | null): Trend {
  if (delta === null) return "hold";
  if (delta >= HOLD_THRESHOLD) return "up";
  if (delta <= -HOLD_THRESHOLD) return "down";
  return "hold";
}

// 추세별 색상만 정적으로 둔다. 라벨 문구는 reports.cards 카탈로그에서 t()로 해석.
const TREND_COLOR: Record<Trend, string> = {
  up: "green",
  down: "red",
  hold: "default",
};

/**
 * R-01 항목별 비교 카드 (description region 3).
 * 제약: 카드 4개 이하, 변화값은 상승/하락/유지로 표시.
 * 예외: 이전 데이터 없음은 현재 점수 카드만 표시.
 */
export function DimensionComparisonCards({
  deltas,
  hasPrevious,
  currentScores,
}: Props) {
  const t = useTranslations("reports.cards");
  const tDim = useTranslations("reports.dimensions");

  // dimension 코드를 카탈로그 라벨로. 알 수 없는 코드는 코드 그대로 폴백.
  const dimLabel = (code: string) =>
    (DIMENSION_KEYS as readonly string[]).includes(code)
      ? tDim(code as (typeof DIMENSION_KEYS)[number])
      : code;
  const trendLabel: Record<Trend, string> = {
    up: t("trendUp"),
    down: t("trendDown"),
    hold: t("trendHold"),
  };

  // 이전 데이터 없음 — 현재 점수 카드만 (description region 3 예외).
  if (!hasPrevious) {
    const entries = Object.entries(currentScores ?? {}).slice(0, MAX_CARDS);
    if (entries.length === 0) {
      return (
        <Card>
          <Empty description={t("emptyCurrent")} />
        </Card>
      );
    }
    return (
      <Card title={t("titleScores")}>
        <Row gutter={[12, 12]}>
          {entries.map(([dim, score]) => (
            <Col key={dim} xs={12} md={6}>
              <Card size="small">
                <Text strong>{dimLabel(dim)}</Text>
                <div style={{ marginTop: 4 }}>
                  <Tag color="blue">
                    {score === null ? "—" : t("scorePoint", { value: score })}
                  </Tag>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>
    );
  }

  // 변화가 큰 순으로 정렬해 상위 4개만 카드로(제약 4개 이하).
  const sorted = Object.entries(deltas)
    .sort((a, b) => Math.abs(b[1] ?? 0) - Math.abs(a[1] ?? 0))
    .slice(0, MAX_CARDS);

  if (sorted.length === 0) {
    return (
      <Card>
        <Empty description={t("emptyChange")} />
      </Card>
    );
  }

  return (
    <Card title={t("titleChange")}>
      <Row gutter={[12, 12]}>
        {sorted.map(([dim, delta]) => {
          const trend = trendOf(delta);
          return (
            <Col key={dim} xs={12} md={6}>
              <Card size="small">
                <Text strong>{dimLabel(dim)}</Text>
                <div style={{ marginTop: 4 }}>
                  <Tag color={TREND_COLOR[trend]}>
                    {trendLabel[trend]}
                    {delta !== null && delta !== 0
                      ? ` ${delta > 0 ? "+" : ""}${delta}`
                      : ""}
                  </Tag>
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>
    </Card>
  );
}
