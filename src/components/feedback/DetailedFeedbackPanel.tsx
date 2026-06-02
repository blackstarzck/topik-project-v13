"use client";

import { Card, Collapse, Empty, Progress, Space, Tag, Typography } from "antd";
import { useTranslations } from "next-intl";
import type { FeedbackDimensionScoreRow } from "@/lib/writing/types";

const { Paragraph, Text } = Typography;

/**
 * E-02 상세 피드백 패널이 다루는 5개 세부 항목 (description region 3):
 * 구조, 논리, 어휘, 문법, 주제 적합성. weakness_level/score로 세부 평가를 보여준다.
 * 제약: 평가 항목 5개 이하. 라벨은 feedback.detail.label.<key>에서 t()로 해석.
 */
const DETAIL_DIMENSION_KEYS: FeedbackDimensionScoreRow["dimension"][] = [
  "structure",
  "content",
  "vocab",
  "grammar",
  "topic_fit",
];

type Props = {
  dimensions: FeedbackDimensionScoreRow[];
};

/**
 * E-02 상세 피드백 패널 (description region 3).
 * 제약: 평가 항목 5개 이하, 각 항목 본문 2줄 우선.
 * 예외: 추천 없음/항목 누락은 빈 상태와 보완 안내 표시.
 */
export function DetailedFeedbackPanel({ dimensions }: Props) {
  const t = useTranslations("feedback.detail");
  const byDim = new Map(dimensions.map((d) => [d.dimension, d] as const));
  const available = DETAIL_DIMENSION_KEYS.filter((key) => byDim.has(key));

  if (available.length === 0) {
    return (
      <Card title={t("cardTitle")}>
        <Empty description={t("emptyDescription")} />
      </Card>
    );
  }

  const items = available.map((key) => {
    const row = byDim.get(key);
    const score = row?.score ?? null;
    const max = row?.score_max ?? 100;
    const percent = score !== null ? Math.round((score / max) * 100) : 0;
    return {
      key,
      label: (
        <Space>
          <Text strong>{t(`label.${key}` as Parameters<typeof t>[0])}</Text>
          <Tag color={score === null ? "default" : percent < 60 ? "red" : "blue"}>
            {score ?? "—"} / {max}
          </Tag>
        </Space>
      ),
      children: (
        <Space direction="vertical" size={8} style={{ width: "100%" }}>
          {score !== null ? (
            <Progress
              percent={percent}
              showInfo={false}
              status={percent < 60 ? "exception" : "normal"}
            />
          ) : null}
          {/* 각 항목 본문 2줄 우선 (description region 3 제약). */}
          <Paragraph
            type="secondary"
            style={{ marginBottom: 0 }}
            ellipsis={{ rows: 2, expandable: true, symbol: t("expandSymbol") }}
          >
            {row?.summary ?? t("itemSummaryFallback")}
          </Paragraph>
        </Space>
      ),
    };
  });

  return (
    <Card title={t("cardTitle")} styles={{ body: { paddingTop: 0 } }}>
      <Collapse
        ghost
        items={items}
        defaultActiveKey={available.length > 0 ? [available[0]] : []}
      />
    </Card>
  );
}
