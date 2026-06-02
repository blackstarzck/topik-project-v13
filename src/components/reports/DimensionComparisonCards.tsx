"use client";

import { Card, Col, Empty, Row, Tag, Typography } from "antd";

const { Text } = Typography;

const DIMENSION_LABELS: Record<string, string> = {
  grammar: "문법",
  vocab: "어휘",
  structure: "구성",
  content: "내용",
  expression: "표현",
  topic_fit: "주제 적합성",
};

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

const TREND_META: Record<Trend, { label: string; color: string }> = {
  up: { label: "상승", color: "green" },
  down: { label: "하락", color: "red" },
  hold: { label: "유지", color: "default" },
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
  // 이전 데이터 없음 — 현재 점수 카드만 (description region 3 예외).
  if (!hasPrevious) {
    const entries = Object.entries(currentScores ?? {}).slice(0, MAX_CARDS);
    if (entries.length === 0) {
      return (
        <Card>
          <Empty description="비교할 항목 점수가 없어요." />
        </Card>
      );
    }
    return (
      <Card title="항목별 점수">
        <Row gutter={[12, 12]}>
          {entries.map(([dim, score]) => (
            <Col key={dim} xs={12} md={6}>
              <Card size="small">
                <Text strong>{DIMENSION_LABELS[dim] ?? dim}</Text>
                <div style={{ marginTop: 4 }}>
                  <Tag color="blue">{score === null ? "—" : `${score}점`}</Tag>
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
        <Empty description="항목별 변화를 계산할 수 없어요." />
      </Card>
    );
  }

  return (
    <Card title="항목별 변화">
      <Row gutter={[12, 12]}>
        {sorted.map(([dim, delta]) => {
          const trend = trendOf(delta);
          const meta = TREND_META[trend];
          return (
            <Col key={dim} xs={12} md={6}>
              <Card size="small">
                <Text strong>{DIMENSION_LABELS[dim] ?? dim}</Text>
                <div style={{ marginTop: 4 }}>
                  <Tag color={meta.color}>
                    {meta.label}
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
