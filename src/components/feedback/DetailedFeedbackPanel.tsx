"use client";

import { Collapse, Empty, Progress, Tag, Typography, theme } from "antd";
import { useTranslations } from "next-intl";
import { AppCard } from "@/components/shared/AppCard";
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

// 카드 본문 상단 패딩 0 — Collapse가 카드 상단에 붙도록(의도적 flush, antd 6.x styles API).
const DETAIL_CARD_STYLES = { body: { paddingTop: 0 } } as const; // ai-check: allow-inline-number 0 = 의도적 flush

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
  const { token } = theme.useToken();
  const byDim = new Map(dimensions.map((d) => [d.dimension, d] as const));
  const available = DETAIL_DIMENSION_KEYS.filter((key) => byDim.has(key));

  if (available.length === 0) {
    return (
      <AppCard title={t("cardTitle")} data-testid="feedback-detail-panel">
        <Empty description={t("emptyDescription")} />
      </AppCard>
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
        <div className="flex flex-wrap items-center gap-2">
          <Text strong data-testid="feedback-detail-item">
            {t(`label.${key}` as Parameters<typeof t>[0])}
          </Text>
          <Tag>
            {score ?? "—"} / {max}
          </Tag>
        </div>
      ),
      children: (
        <div className="flex w-full flex-col gap-2">
          {score !== null ? (
            <Progress
              percent={percent}
              showInfo={false}
              strokeColor={token.colorText}
            />
          ) : null}
          {/* 각 항목 본문 2줄 우선 (description region 3 제약). */}
          <Paragraph
            type="secondary"
            className="mb-0"
            ellipsis={{ rows: 2, expandable: true, symbol: t("expandSymbol") }}
          >
            {row?.summary ?? t("itemSummaryFallback")}
          </Paragraph>
        </div>
      ),
    };
  });

  return (
    <AppCard
      title={t("cardTitle")}
      styles={DETAIL_CARD_STYLES}
      data-testid="feedback-detail-panel"
    >
      <Collapse
        ghost
        items={items}
        defaultActiveKey={available.length > 0 ? [available[0]] : []}
      />
    </AppCard>
  );
}
