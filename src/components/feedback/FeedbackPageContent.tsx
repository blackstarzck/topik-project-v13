import { Space } from "antd";
import { DimensionCardGrid } from "./DimensionCardGrid";
import { FeedbackPendingPanel } from "./FeedbackPendingPanel";
import { FeedbackRecommendationCard } from "./FeedbackRecommendationCard";
import { FeedbackSummary } from "./FeedbackSummary";
import { NextActionBar } from "./NextActionBar";
import { SentenceFeedbackList } from "./SentenceFeedbackList";
import type {
  FeedbackBundle,
  WritingSubmissionRow,
} from "@/lib/writing/types";

type Props = {
  submission: WritingSubmissionRow;
  bundle: FeedbackBundle | null;
  withSentences: boolean;
};

export function FeedbackPageContent({
  submission,
  bundle,
  withSentences,
}: Props) {
  if (submission.feedback_status !== "complete" || !bundle) {
    return <FeedbackPendingPanel submissionId={submission.id} />;
  }
  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <FeedbackSummary feedback={bundle.feedback} />
      <DimensionCardGrid rows={bundle.dimensions} />
      {withSentences ? <SentenceFeedbackList rows={bundle.sentences} /> : null}
      <FeedbackRecommendationCard />
      <NextActionBar
        submissionId={submission.id}
        retryHref={`/writing/${submission.question_no}?problem=${submission.problem_id}`}
        nextHref="/practice/recommendations"
        withPdf={withSentences}
        retryLabel={withSentences ? "다시 작성" : "다시 풀기"}
      />
    </Space>
  );
}
