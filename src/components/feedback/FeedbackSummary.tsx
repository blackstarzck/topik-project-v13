"use client";

import { Alert, Statistic, Typography } from "antd";
import { useTranslations } from "next-intl";
import { AppCard } from "@/components/shared/AppCard";
import type { WritingFeedbackRow } from "@/lib/writing/types";

const { Paragraph } = Typography;

type Props = { feedback: WritingFeedbackRow };

/**
 * E-01/E-02 점수/총평 요약 (description region 1).
 * 제약: 총평 3줄 이하, 점수는 첫 영역에 우선 노출.
 * 예외: 점수 산출 실패(score 없음 또는 feedback.status='failed') 시 총평 대신
 *       분석 실패 안내를 표시한다.
 */
export function FeedbackSummary({ feedback }: Props) {
  const t = useTranslations("feedback.summary");
  const score = feedback.score_total ?? null;
  const max = feedback.score_max ?? 100;
  const scoreFailed = feedback.status === "failed" || score === null;

  if (scoreFailed) {
    return (
      <AppCard>
        <Alert
          type="warning"
          showIcon
          title={t("scoreFailedTitle")}
          description={t("scoreFailedDescription")}
        />
      </AppCard>
    );
  }

  return (
    <AppCard>
      <Statistic title={t("scoreTitle")} value={score} suffix={`/ ${max}`} />
      <Paragraph
        type="secondary"
        style={{ marginTop: 12, marginBottom: 0 }}
        ellipsis={{ rows: 3 }}
      >
        {feedback.overall_summary ?? t("overallFallback")}
      </Paragraph>
    </AppCard>
  );
}
