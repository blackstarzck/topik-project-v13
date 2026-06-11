"use client";

import { Button, Col, Row, Tag, Typography } from "antd";
import { useTranslations } from "next-intl";
import { AppCard } from "@/components/shared/AppCard";
import {
  FEEDBACK_DIMENSIONS,
  type FeedbackDimensionScoreRow,
} from "@/lib/writing/types";

const { Text } = Typography;

type Props = {
  rows: FeedbackDimensionScoreRow[];
  /**
   * 표시할 최대 카드 수. E-01 단답 description region 2 제약은 "카드 4개 이하".
   * 미지정 시 전체 6개 차원을 표시(장문은 상세 패널과 함께 모두 노출).
   */
  maxCards?: number;
  /** 분석 실패 항목의 재분석 안내 클릭(있을 때만 버튼 노출). */
  onReanalyze?: () => void;
};

/**
 * E-01/E-02 항목별 피드백 카드 (description region 2).
 * 제약: 카드 제목 14자, 본문 2줄.
 * 예외: 분석 실패 항목(점수 없음)은 회색 카드와 재분석 안내 표시.
 */
export function DimensionCardGrid({ rows, maxCards, onReanalyze }: Props) {
  const t = useTranslations("feedback.dimensions");
  const byDim = new Map(rows.map((r) => [r.dimension, r] as const));
  // maxCards가 있으면 점수가 있는 차원을 우선 노출하고 나머지로 채운다.
  const ordered = maxCards
    ? [...FEEDBACK_DIMENSIONS].sort((a, b) => {
        const sa = byDim.get(a)?.score ?? null;
        const sb = byDim.get(b)?.score ?? null;
        if (sa === null && sb !== null) return 1;
        if (sa !== null && sb === null) return -1;
        return 0;
      })
    : FEEDBACK_DIMENSIONS;
  const visible = maxCards ? ordered.slice(0, maxCards) : ordered;

  return (
    <Row gutter={[12, 12]} data-testid="feedback-dimension-grid">
      {visible.map((dim) => {
        const row = byDim.get(dim);
        const score = row?.score ?? null;
        const failed = score === null;
        const tone = failed
          ? "default"
          : score >= 80
            ? "green"
            : score >= 65
              ? "gold"
              : "red";
        return (
          <Col key={dim} xs={24} md={12} lg={8}>
            <AppCard
              size="small"
              className={[
                "feedback-dimension-card",
                failed ? "feedback-dimension-card--failed" : null,
              ]
                .filter(Boolean)
                .join(" ")}
              data-testid="feedback-dimension-card"
            >
              <Text strong>{t(`label.${dim}`)}</Text>
              <div className="feedback-dimension-card__score">
                <Tag color={tone}>
                  {score ?? "—"} / {row?.score_max ?? 100}
                </Tag>
              </div>
              {failed ? (
                <div>
                  <Text
                    type="secondary"
                    className="feedback-dimension-card__failed-text"
                  >
                    {t("failedText")}
                  </Text>
                  {onReanalyze ? (
                    <div className="feedback-dimension-card__actions">
                      <Button
                        size="small"
                        type="link"
                        onClick={onReanalyze}
                        className="feedback-inline-link"
                      >
                        {t("reanalyze")}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <Text
                  type="secondary"
                  title={row?.summary ?? undefined}
                  className="feedback-two-line"
                >
                  {row?.summary ?? t("summaryFallback")}
                </Text>
              )}
            </AppCard>
          </Col>
        );
      })}
    </Row>
  );
}
