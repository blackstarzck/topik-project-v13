"use client";

import { Col, Empty, Row, Statistic, Typography } from "antd";
import { useTranslations } from "next-intl";
import { AppCard } from "@/components/shared/AppCard";

const { Text } = Typography;

type Props = {
  currentScore: number | null;
  scoreDelta: number | null;
  changedDimensions: number;
  hasPrevious: boolean;
};

export function ComparisonKpiBlock({
  currentScore,
  scoreDelta,
  changedDimensions,
  hasPrevious,
}: Props) {
  const t = useTranslations("reports.kpi");

  if (currentScore === null) {
    return (
      <AppCard data-testid="comparison-kpi-block">
        <Empty description={t("emptyScore")} />
      </AppCard>
    );
  }

  return (
    <AppCard data-testid="comparison-kpi-block">
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8} data-testid="comparison-kpi-item">
          <Statistic
            title={t("currentTotal")}
            value={currentScore}
            suffix={t("suffixPoint")}
          />
        </Col>
        <Col xs={24} md={8} data-testid="comparison-kpi-item">
          {hasPrevious && scoreDelta !== null ? (
            <Statistic
              title={t("improvement")}
              value={Math.abs(scoreDelta)}
              precision={1}
              prefix={
                <span aria-hidden>
                  {scoreDelta > 0 ? "+" : scoreDelta < 0 ? "-" : "="}
                </span>
              }
              suffix={t("suffixPoint")}
            />
          ) : (
            <Statistic
              title={t("improvement")}
              value={0}
              formatter={() => (
                <Text type="secondary" className="text-lg">
                  {t("noComparison")}
                </Text>
              )}
            />
          )}
        </Col>
        <Col xs={24} md={8} data-testid="comparison-kpi-item">
          <Statistic
            title={t("changedDimensions")}
            value={hasPrevious ? changedDimensions : 0}
            suffix={hasPrevious ? t("suffixCount") : ""}
            formatter={
              hasPrevious
                ? undefined
                : () => (
                    <Text type="secondary" className="text-lg">
                      {t("singleResult")}
                    </Text>
                  )
            }
          />
        </Col>
      </Row>
    </AppCard>
  );
}
