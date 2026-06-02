"use client";

import { Alert, Card, Statistic, Typography } from "antd";
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
  const score = feedback.score_total ?? null;
  const max = feedback.score_max ?? 100;
  const scoreFailed = feedback.status === "failed" || score === null;

  if (scoreFailed) {
    return (
      <Card>
        <Alert
          type="warning"
          showIcon
          message="점수를 산출하지 못했어요"
          description="이번 답안은 점수 계산에 실패했어요. 아래 분석 결과만 참고하거나, 다시 분석을 시도해 주세요."
        />
      </Card>
    );
  }

  return (
    <Card>
      <Statistic title="총평 점수" value={score} suffix={`/ ${max}`} />
      <Paragraph
        type="secondary"
        style={{ marginTop: 12, marginBottom: 0 }}
        ellipsis={{ rows: 3 }}
      >
        {feedback.overall_summary ?? "총평이 준비되는 중입니다."}
      </Paragraph>
    </Card>
  );
}
