"use client";

import type { ReactNode } from "react";
import { Typography } from "antd";
import { useTranslations } from "next-intl";
import { AppCard } from "@/components/shared/AppCard";

const { Paragraph, Text } = Typography;

type WeakDimension = { dimension: string; score: number };

type Props = {
  recentSubmissions: number;
  averageScore: number | null;
  weakestDimensions: WeakDimension[];
  estimatedMinutes?: number | null;
  recommendedType?: string | null;
};

const DIMENSION_LABEL_KEYS: Record<string, string> = {
  grammar: "dimGrammar",
  vocab: "dimVocab",
  structure: "dimStructure",
  content: "dimContent",
  expression: "dimExpression",
  topic_fit: "dimTopicFit",
};

function SummaryMetricCard({
  title,
  value,
  detail,
}: {
  title: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <AppCard data-testid="next-summary-card" className="h-full w-full">
      <div className="flex h-full flex-col gap-3">
        <Text type="secondary" className="block text-sm">
          {title}
        </Text>
        <Paragraph
          strong
          className="mb-0 text-xl leading-7"
          data-testid="next-summary-value"
        >
          {value}
        </Paragraph>
        {detail ? (
          <Text
            type="secondary"
            className="block text-xs"
            data-testid="next-summary-detail"
          >
            {detail}
          </Text>
        ) : null}
      </div>
    </AppCard>
  );
}

export function SummaryCardRow({
  recentSubmissions,
  averageScore,
  weakestDimensions,
  estimatedMinutes,
  recommendedType,
}: Props) {
  const t = useTranslations("practice.next");
  const tCommon = useTranslations("practice.common");
  const weaknessValue =
    weakestDimensions.length === 0
      ? t("summaryNotEnoughData")
      : weakestDimensions
          .slice(0, 3)
          .map((dimension) => {
            const labelKey = DIMENSION_LABEL_KEYS[dimension.dimension];
            const label = labelKey
              ? tCommon(labelKey as Parameters<typeof tCommon>[0])
              : dimension.dimension;
            return `${label} ${tCommon("score", {
              score: Math.round(dimension.score),
            })}`;
          })
          .join(" · ");
  const recentAverageValue = t("summaryRecentAverage", {
    count: recentSubmissions,
    average:
      averageScore != null
        ? tCommon("score", { score: averageScore.toFixed(1) })
        : t("summaryDataShort"),
  });
  const estimatedTimeValue =
    estimatedMinutes != null
      ? tCommon("minutes", { minutes: estimatedMinutes })
      : t("noInfo");

  return (
    <div
      className="grid auto-rows-fr grid-cols-1 gap-4 md:grid-cols-3"
      data-testid="next-summary-row"
    >
      <SummaryMetricCard
        title={t("summaryWeaknessTitle")}
        value={weaknessValue}
        detail={recentAverageValue}
      />
      <SummaryMetricCard
        title={t("summaryNextTypeTitle")}
        value={recommendedType ?? t("summaryTypePending")}
      />
      <SummaryMetricCard
        title={t("summaryEstimatedTime")}
        value={estimatedTimeValue}
      />
    </div>
  );
}
