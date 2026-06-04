"use client";

import { Col, Empty, Row, Statistic, Typography } from "antd";
import { useTranslations } from "next-intl";
import { AppCard } from "@/components/shared/AppCard";

const { Text } = Typography;

type Props = {
  /** 현재 총점. null이면 점수 산출 실패. */
  currentScore: number | null;
  /** 개선 폭(현재-이전). null이면 이전 데이터 없음. */
  scoreDelta: number | null;
  /** 변화한 항목 수(상승/하락 합). */
  changedDimensions: number;
  /** 비교 데이터가 부족하면 단일 결과 요약으로 대체(description region 1 예외). */
  hasPrevious: boolean;
};

/**
 * R-01 비교 KPI (description region 1).
 * 제약: KPI 라벨 1줄, 비교 대상 2개 기본.
 * 예외: 비교 데이터 부족 시 단일 결과 요약으로 대체.
 */
export function ComparisonKpiBlock({
  currentScore,
  scoreDelta,
  changedDimensions,
  hasPrevious,
}: Props) {
  const t = useTranslations("reports.kpi");

  if (currentScore === null) {
    return (
      <AppCard>
        <Empty description={t("emptyScore")} />
      </AppCard>
    );
  }

  const deltaColor =
    scoreDelta === null
      ? undefined
      : scoreDelta > 0
        ? "#3f8600"
        : scoreDelta < 0
          ? "#cf1322"
          : undefined;

  return (
    <AppCard>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Statistic
            title={t("currentTotal")}
            value={currentScore}
            suffix={t("suffixPoint")}
          />
        </Col>
        <Col xs={24} md={8}>
          {hasPrevious && scoreDelta !== null ? (
            <Statistic
              title={t("improvement")}
              value={Math.abs(scoreDelta)}
              precision={1}
              styles={{ content: { color: deltaColor } }}
              prefix={
                <span aria-hidden>
                  {scoreDelta > 0 ? "▲" : scoreDelta < 0 ? "▼" : "—"}
                </span>
              }
              suffix={t("suffixPoint")}
            />
          ) : (
            <Statistic
              title={t("improvement")}
              value="—"
              formatter={() => (
                <Text type="secondary" style={{ fontSize: 16 }}>
                  {t("noComparison")}
                </Text>
              )}
            />
          )}
        </Col>
        <Col xs={24} md={8}>
          <Statistic
            title={t("changedDimensions")}
            value={hasPrevious ? changedDimensions : 0}
            suffix={hasPrevious ? t("suffixCount") : ""}
            formatter={
              hasPrevious
                ? undefined
                : () => (
                    <Text type="secondary" style={{ fontSize: 16 }}>
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
