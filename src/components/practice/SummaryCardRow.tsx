"use client";

import { Col, Row, Statistic, Tag, Typography, theme } from "antd";
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
  const { token } = theme.useToken();

  return (
    <Row gutter={[SPACING.md, SPACING.md]} data-testid="next-summary-row">
      <Col xs={24} md={8}>
        <AppCard data-testid="next-summary-card">
          <Text type="secondary">{t("summaryWeaknessTitle")}</Text>
          <div style={{ marginTop: SPACING.sm }}>
            {weakestDimensions.length === 0 ? (
              <Text>{t("summaryNotEnoughData")}</Text>
            ) : (
              weakestDimensions.slice(0, 3).map((dimension) => (
                <Tag key={dimension.dimension} color="red">
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
          <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
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
          <div style={{ marginTop: SPACING.sm }}>
            <Text strong style={{ fontSize: token.fontSizeHeading4 }}>
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
