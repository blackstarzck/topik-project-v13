"use client";

import { Collapse, Progress, Tag, Typography, theme } from "antd";
import { useTranslations } from "next-intl";
import type { FeedbackDimensionScoreRow } from "@/lib/writing/types";

const { Paragraph, Text, Title } = Typography;

/**
 * E-02 상세 피드백 패널은 상단 요약에 이미 노출되는 content/structure를
 * 반복하지 않고, 남은 세부 항목만 보여준다.
 */
const DETAIL_DIMENSION_KEYS: FeedbackDimensionScoreRow["dimension"][] = [
  "vocab",
  "grammar",
  "topic_fit",
];

type Props = {
  dimensions: FeedbackDimensionScoreRow[];
};

/**
 * E-02 상세 피드백 패널 (description region 3).
 * 제약: 평가 항목 5개 이하, 각 항목 본문은 줄 수 제한 없이 전체 노출.
 * 예외: 보여줄 세부 항목이 없으면 패널을 숨긴다.
 */
export function DetailedFeedbackPanel({ dimensions }: Props) {
  const t = useTranslations("feedback.detail");
  const { token } = theme.useToken();
  const byDim = new Map(dimensions.map((d) => [d.dimension, d] as const));
  const available = DETAIL_DIMENSION_KEYS.filter((key) => byDim.has(key));

  if (available.length === 0) return null;

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
          <Paragraph type="secondary" className="mb-0">
            {row?.summary ?? t("itemSummaryFallback")}
          </Paragraph>
        </div>
      ),
    };
  });

  return (
    <section
      className="flex flex-col gap-4"
      data-testid="feedback-detail-panel"
    >
      <Title level={5} className="m-0">
        {t("cardTitle")}
      </Title>
      <Collapse
        ghost
        items={items}
        defaultActiveKey={available.length > 0 ? [available[0]] : []}
      />
    </section>
  );
}
