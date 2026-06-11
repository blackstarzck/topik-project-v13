"use client";

import { Col, Row, Statistic, Tag, Typography } from "antd";
import { useTranslations } from "next-intl";
import { AppCard } from "@/components/shared/AppCard";
import { SPACING } from "@/theme/spacing";

const { Text } = Typography;

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

export function SummaryCardRow({
  recentSubmissions,
  averageScore,
  weakestDimensions,
  estimatedMinutes,
  recommendedType,
}: Props) {
  const t = useTranslations("practice.next");
  const tCommon = useTranslations("practice.common");

  return (
    <Row gutter={[SPACING.md, SPACING.md]} data-testid="next-summary-row">
      <Col xs={24} md={8}>
        <AppCard data-testid="next-summary-card">
          <Text type="secondary">{t("summaryWeaknessTitle")}</Text>
          <div className="mt-3">
            {weakestDimensions.length === 0 ? (
              <Text>{t("summaryNotEnoughData")}</Text>
            ) : (
              weakestDimensions.slice(0, 3).map((dimension) => (
                <Tag key={dimension.dimension}>
                  {DIMENSION_LABEL_KEYS[dimension.dimension]
                    ? tCommon(
                        DIMENSION_LABEL_KEYS[
                          dimension.dimension
                        ] as Parameters<typeof tCommon>[0],
                      )
                    : dimension.dimension}{" "}
                  {tCommon("score", { score: Math.round(dimension.score) })}
                </Tag>
              ))
            )}
          </div>
          <Text type="secondary" className="text-xs">
            {t("summaryRecentAverage", {
              count: recentSubmissions,
              average:
                averageScore != null
                  ? tCommon("score", { score: averageScore.toFixed(1) })
                  : t("summaryDataShort"),
            })}
          </Text>
        </AppCard>
      </Col>
      <Col xs={24} md={8}>
        <AppCard data-testid="next-summary-card">
          <Text type="secondary">{t("summaryNextTypeTitle")}</Text>
          <div className="mt-3">
            <Text strong className="text-xl">
              {recommendedType ?? t("summaryTypePending")}
            </Text>
          </div>
        </AppCard>
      </Col>
      <Col xs={24} md={8}>
        <AppCard data-testid="next-summary-card">
          <Statistic
            title={t("summaryEstimatedTime")}
            value={estimatedMinutes ?? 0}
            suffix={
              estimatedMinutes != null ? tCommon("minuteSuffix") : t("noInfo")
            }
          />
        </AppCard>
      </Col>
    </Row>
  );
}
