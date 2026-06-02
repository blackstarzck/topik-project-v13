"use client";

import { Card, Empty, Progress, Tabs, Tag, Typography } from "antd";
import { useTranslations } from "next-intl";

const { Text, Paragraph } = Typography;

/** dimension → practice.common label key. */
const DIMENSION_LABEL_KEYS: Record<string, string> = {
  grammar: "dimGrammar",
  vocab: "dimVocab",
  structure: "dimStructure",
  content: "dimContent",
  expression: "dimExpression",
  topic_fit: "dimTopicFit",
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
  const t = useTranslations("practice.weakness");
  const tCommon = useTranslations("practice.common");

  function dimensionLabel(dimension: string) {
    return DIMENSION_LABEL_KEYS[dimension]
      ? tCommon(DIMENSION_LABEL_KEYS[dimension] as Parameters<typeof tCommon>[0])
      : dimension;
  }

  // Preferred path — all 4 tabs (incl. disabled under-sampled ones).
  if (tabSummaries && tabSummaries.length > 0) {
    const firstReady = tabSummaries.find((s) => s.ready);
    const items = tabSummaries.map((s) => {
      const label = dimensionLabel(s.dimension);
      if (!s.ready) {
        return {
          key: s.dimension,
          // 비활성 탭 — 필요한 답안 수 표시 (X-07 §2 예외).
          label: t("tabNeedMore", { label, needed: s.neededAnswerCount }),
          disabled: true,
          children: (
            <Card>
              <Empty
                description={t("tabNeedMoreDescription", {
                  label,
                  needed: s.neededAnswerCount,
                  current: s.sampleCount,
                })}
              />
            </Card>
          ),
        };
      }
      const score = s.avgScore ?? 0;
      const intStatus = statusFor(score);
      return {
        key: s.dimension,
        label,
        children: (
          <Card>
            <Progress
              percent={Math.round(score)}
              status={intStatus}
              format={(p) => tCommon("score", { score: p ?? 0 })}
            />
            <Paragraph style={{ marginTop: 12 }}>
              <Text strong>{label}</Text> {t("averageScoreInline")}{" "}
              <Tag color={intStatus === "exception" ? "red" : "blue"}>
                {tCommon("score", { score: Math.round(score) })}
              </Tag>
              <Text type="secondary">
                {" "}
                · {t("sampleCount", { count: s.sampleCount })}
              </Text>
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
        <Empty description={t("tabsEmpty")} />
      </Card>
    );
  }

  const items = dimensions.map((d) => {
    const label = dimensionLabel(d.dimension);
    const intStatus = statusFor(d.averageScore);

    return {
      key: d.dimension,
      label,
      children: (
        <Card>
          <Progress
            percent={Math.round(d.averageScore)}
            status={intStatus}
            format={(p) => tCommon("score", { score: p ?? 0 })}
          />
          <Paragraph style={{ marginTop: 12 }}>
            <Text strong>{label}</Text> {t("averageScoreInline")}{" "}
            <Tag color={intStatus === "exception" ? "red" : "blue"}>
              {tCommon("score", { score: Math.round(d.averageScore) })}
            </Tag>
            {d.sampleCount != null ? (
              <Text type="secondary">
                {" "}
                · {t("sampleCount", { count: d.sampleCount })}
              </Text>
            ) : null}
          </Paragraph>
        </Card>
      ),
    };
  });

  return <Tabs items={items} />;
}
