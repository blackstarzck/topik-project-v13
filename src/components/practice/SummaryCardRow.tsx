"use client";

import { Col, Row, Statistic, Tag, Typography } from "antd";
import { useTranslations } from "next-intl";
import { AppCard } from "@/components/shared/AppCard";

const { Text } = Typography;

type WeakDimension = { dimension: string; score: number };

type Props = {
  recentSubmissions: number;
  averageScore: number | null;
  weakestDimensions: WeakDimension[];
  /**
   * Phase 7-D follow-up (R-02 §1) — 예상 학습 시간 카드. Minutes from the
   * recommended item's `estimated_minutes`. null → "정보 없음".
   */
  estimatedMinutes?: number | null;
  /** 다음 추천 유형 라벨 (예: "53번 장문"). null → "추천 준비 중". */
  recommendedType?: string | null;
};

/** dimension → practice.common label key. */
const DIMENSION_LABEL_KEYS: Record<string, string> = {
  grammar: "dimGrammar",
  vocab: "dimVocab",
  structure: "dimStructure",
  content: "dimContent",
  expression: "dimExpression",
  topic_fit: "dimTopicFit",
};

/**
 * Phase 7-D Task 6 (P1-2) — R-02 성과 요약 카드.
 * IA: docs/Wireframe/17-R-02-next-problem-recommendation/description.md §1.
 * 제약: 요약 카드 3개 이하, 각 카드 제목 18자, 수치 1줄.
 * 3개 카드: 완료 문제의 약점 / 다음 추천 유형 / 예상 학습 시간.
 */
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
    <Row gutter={16} data-testid="summary-card-row">
      <Col xs={24} md={8}>
        <AppCard>
          <Text type="secondary">{t("summaryWeaknessTitle")}</Text>
          <div style={{ marginTop: 8 }}>
            {weakestDimensions.length === 0 ? (
              <Text>{t("summaryNotEnoughData")}</Text>
            ) : (
              weakestDimensions.slice(0, 3).map((d) => (
                <Tag key={d.dimension} color="red">
                  {DIMENSION_LABEL_KEYS[d.dimension]
                    ? tCommon(
                        DIMENSION_LABEL_KEYS[d.dimension] as Parameters<
                          typeof tCommon
                        >[0],
                      )
                    : d.dimension}{" "}
                  {tCommon("score", { score: Math.round(d.score) })}
                </Tag>
              ))
            )}
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>
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
        <AppCard>
          <Text type="secondary">{t("summaryNextTypeTitle")}</Text>
          <div style={{ marginTop: 8 }}>
            <Text strong style={{ fontSize: 18 }}>
              {recommendedType ?? t("summaryTypePending")}
            </Text>
          </div>
        </AppCard>
      </Col>
      <Col xs={24} md={8}>
        <AppCard>
          <Statistic
            title={t("summaryEstimatedTime")}
            value={estimatedMinutes ?? 0}
            suffix={estimatedMinutes != null ? tCommon("minuteSuffix") : t("noInfo")}
          />
        </AppCard>
      </Col>
    </Row>
  );
}
