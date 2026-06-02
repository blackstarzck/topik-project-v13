"use client";

import { Card, Empty, Progress, Tabs, Tag, Typography } from "antd";

const { Text, Paragraph } = Typography;

const DIMENSION_LABELS: Record<string, string> = {
  grammar: "문법",
  vocab: "어휘",
  structure: "구성",
  content: "내용",
  expression: "표현",
  topic_fit: "주제 적합성",
};

type WeakDimension = {
  dimension: string;
  averageScore: number;
  sampleCount?: number;
};

/** X-07 §2 — full tab summary incl. under-sampled (disabled) dimensions. */
export type DimensionTabSummaryProp = {
  dimension: string;
  avgScore: number | null;
  sampleCount: number;
  ready: boolean;
  neededAnswerCount: number;
};

type Props = {
  /** Legacy: weak dimensions only (kept for back-compat with existing callers/tests). */
  dimensions: WeakDimension[];
  /**
   * Phase 7-D follow-up (X-07 §2) — when provided, render ALL FOUR tabs
   * (문법/어휘/구성/주제 적합성) including under-sampled ones as disabled tabs
   * with the remaining-answer count. Takes precedence over `dimensions`.
   */
  tabSummaries?: DimensionTabSummaryProp[];
};

function statusFor(score: number) {
  return score >= 70 ? "success" : score >= 50 ? "normal" : "exception";
}

/**
 * Phase 7-D Task 7 (P1-3) — X-07 dimension tabs.
 * IA spec: docs/Wireframe/29-X-07-weakness-based-recommendations/description.md §2.
 * 제약: 탭 4개, 선택 탭 1개만 활성. 예외: 답안 부족 탭은 비활성 및 필요한 답안 수 표시.
 */
export function DimensionTabs({ dimensions, tabSummaries }: Props) {
  // Preferred path — all 4 tabs (incl. disabled under-sampled ones).
  if (tabSummaries && tabSummaries.length > 0) {
    const firstReady = tabSummaries.find((t) => t.ready);
    const items = tabSummaries.map((t) => {
      const label = DIMENSION_LABELS[t.dimension] ?? t.dimension;
      if (!t.ready) {
        return {
          key: t.dimension,
          // 비활성 탭 — 필요한 답안 수 표시 (X-07 §2 예외).
          label: `${label} (답안 ${t.neededAnswerCount}개 더 필요)`,
          disabled: true,
          children: (
            <Card>
              <Empty
                description={`${label} 분석에는 답안이 ${t.neededAnswerCount}개 더 필요해요. (현재 ${t.sampleCount}개)`}
              />
            </Card>
          ),
        };
      }
      const score = t.avgScore ?? 0;
      const intStatus = statusFor(score);
      return {
        key: t.dimension,
        label,
        children: (
          <Card>
            <Progress
              percent={Math.round(score)}
              status={intStatus}
              format={(p) => `${p}점`}
            />
            <Paragraph style={{ marginTop: 12 }}>
              <Text strong>{label}</Text> 평균 점수{" "}
              <Tag color={intStatus === "exception" ? "red" : "blue"}>
                {Math.round(score)}점
              </Tag>
              <Text type="secondary"> · {t.sampleCount}개 표본</Text>
            </Paragraph>
          </Card>
        ),
      };
    });
    return (
      <Tabs items={items} defaultActiveKey={firstReady?.dimension} />
    );
  }

  // Legacy fallback — weak dimensions only.
  if (dimensions.length === 0) {
    return (
      <Card>
        <Empty description="평가된 차원이 아직 없습니다. 글쓰기를 제출하면 차원별 점수가 누적됩니다." />
      </Card>
    );
  }

  const items = dimensions.map((d) => {
    const label = DIMENSION_LABELS[d.dimension] ?? d.dimension;
    const intStatus = statusFor(d.averageScore);

    return {
      key: d.dimension,
      label,
      children: (
        <Card>
          <Progress
            percent={Math.round(d.averageScore)}
            status={intStatus}
            format={(p) => `${p}점`}
          />
          <Paragraph style={{ marginTop: 12 }}>
            <Text strong>{label}</Text> 평균 점수{" "}
            <Tag color={intStatus === "exception" ? "red" : "blue"}>
              {Math.round(d.averageScore)}점
            </Tag>
            {d.sampleCount != null ? (
              <Text type="secondary"> · {d.sampleCount}개 표본</Text>
            ) : null}
          </Paragraph>
        </Card>
      ),
    };
  });

  return <Tabs items={items} />;
}
