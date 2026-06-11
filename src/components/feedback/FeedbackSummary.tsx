"use client";

import { Alert, Space, Statistic, Tag, Typography } from "antd";
import { useTranslations } from "next-intl";
import { AppCard } from "@/components/shared/AppCard";
import type {
  QuestionNo,
  WritingFeedbackRow,
  WritingSubmissionRow,
} from "@/lib/writing/types";

const { Paragraph } = Typography;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

type Props = {
  feedback: WritingFeedbackRow;
  submission?: Pick<
    WritingSubmissionRow,
    "char_count" | "question_no" | "submitted_at"
  >;
};

function formatSubmittedAtKst(value: string): string | null {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  const date = new Date(time + KST_OFFSET_MS);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  const second = String(date.getUTCSeconds()).padStart(2, "0");
  return `${year}.${month}.${day} ${hour}:${minute}:${second} KST`;
}

function navQuestionKey(questionNo: number): `writing${QuestionNo}` {
  if (questionNo === 51) return "writing51";
  if (questionNo === 52) return "writing52";
  if (questionNo === 53) return "writing53";
  return "writing54";
}

/**
 * E-01/E-02 점수/총평 요약 (description region 1).
 * 제약: 총평 3줄 이하, 점수는 첫 영역에 우선 노출.
 * 예외: 점수 산출 실패(score 없음 또는 feedback.status='failed') 시 총평 대신
 *       분석 실패 안내를 표시한다.
 */
export function FeedbackSummary({ feedback, submission }: Props) {
  const t = useTranslations("feedback.summary");
  const tAnalysis = useTranslations("feedback.analysis");
  const tNav = useTranslations("nav");
  const score = feedback.score_total ?? null;
  const max = feedback.score_max ?? 100;
  const scoreFailed = feedback.status === "failed" || score === null;
  const submittedAt = submission?.submitted_at
    ? formatSubmittedAtKst(submission.submitted_at)
    : null;

  if (scoreFailed) {
    return (
      <AppCard data-testid="feedback-summary">
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
    <AppCard data-testid="feedback-summary">
      <Statistic title={t("scoreTitle")} value={score} suffix={`/ ${max}`} />
      {submission ? (
        <Space
          wrap
          size={[8, 8]}
          className="feedback-summary-meta"
          data-testid="feedback-summary-meta"
        >
          <Tag color="blue">
            {tAnalysis("questionLabel", { questionNo: submission.question_no })}
          </Tag>
          <Tag>{tNav(navQuestionKey(submission.question_no))}</Tag>
          <Tag>{tAnalysis("charsLabel", { count: submission.char_count })}</Tag>
          {submittedAt ? (
            <Tag>{tAnalysis("submittedAtLabel", { submittedAt })}</Tag>
          ) : null}
        </Space>
      ) : null}
      <Paragraph
        type="secondary"
        className="feedback-summary-copy"
        ellipsis={{ rows: 3 }}
      >
        {feedback.overall_summary ?? t("overallFallback")}
      </Paragraph>
    </AppCard>
  );
}
