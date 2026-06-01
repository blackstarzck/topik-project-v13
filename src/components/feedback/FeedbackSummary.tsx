"use client";

import { Card, Statistic, Typography } from "antd";
import type { WritingFeedbackRow } from "@/lib/writing/types";

const { Paragraph } = Typography;

type Props = { feedback: WritingFeedbackRow };

export function FeedbackSummary({ feedback }: Props) {
  const score = feedback.score_total ?? null;
  const max = feedback.score_max ?? 100;
  return (
    <Card>
      <Statistic
        title="총평 점수"
        value={score ?? "—"}
        suffix={score !== null ? `/ ${max}` : ""}
      />
      <Paragraph type="secondary" style={{ marginTop: 12 }}>
        {feedback.overall_summary ?? "총평이 준비되는 중입니다."}
      </Paragraph>
    </Card>
  );
}
