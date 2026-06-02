"use client";

import { Alert, Space } from "antd";
import { DetailedFeedbackPanel } from "./DetailedFeedbackPanel";
import { DimensionCardGrid } from "./DimensionCardGrid";
import { FeedbackPendingPanel } from "./FeedbackPendingPanel";
import { FeedbackRecommendationCards } from "./FeedbackRecommendationCards";
import { FeedbackSummary } from "./FeedbackSummary";
import { NextActionBar } from "./NextActionBar";
import { SentenceFeedbackList } from "./SentenceFeedbackList";
import { useRouter } from "next/navigation";
import type {
  FeedbackBundle,
  WritingSubmissionRow,
} from "@/lib/writing/types";

type Props = {
  submission: WritingSubmissionRow;
  bundle: FeedbackBundle | null;
  withSentences: boolean;
  /** 현재 화면 경로 — 분석 완료/재분석 시 RSC 갱신에 사용. */
  reloadHref: string;
  /** 현재 사용자 id — 보관함 저장 row owner. */
  userId: string;
  /** 보관함 저장 권한 잠금(보기 전용 공유 등). */
  saveLocked?: boolean;
};

/**
 * E-01 단답 / E-02 장문 피드백 화면 오케스트레이터.
 *
 * 상태 분기:
 *   - pending/analyzing → D-M2 로딩(무한 로딩 아님; status polling으로 종료)
 *   - failed + 데이터 없음 → 분석 실패 안내(STOP loading) + 재시도
 *   - complete/failed + 부분 데이터(writing_feedback.status='partial') → 가능한
 *     항목 표시 + 누락 사유 안내
 *   - complete → 전체 피드백
 */
export function FeedbackPageContent({
  submission,
  bundle,
  withSentences,
  reloadHref,
  userId,
  saveLocked = false,
}: Props) {
  const router = useRouter();
  const status = submission.feedback_status;

  // 아직 분석 중 — D-M2 로딩 패널. status가 failed/complete가 되면 패널이 스스로
  // 멈추거나(failed) RSC를 갱신(complete)한다.
  if ((status === "pending" || status === "analyzing") && !bundle) {
    return (
      <FeedbackPendingPanel
        submissionId={submission.id}
        reloadHref={reloadHref}
        initialStatus={status}
      />
    );
  }

  // 분석 실패 + 결과 없음 — 무한 로딩을 멈추고 정직하게 실패를 알린다.
  if (status === "failed" && !bundle) {
    return (
      <FeedbackPendingPanel
        submissionId={submission.id}
        reloadHref={reloadHref}
        initialStatus="failed"
      />
    );
  }

  // 결과는 없는데 상태가 complete인 경계(데이터 정합성 문제) — 빈 상태 안내.
  if (!bundle) {
    return (
      <Alert
        type="info"
        showIcon
        message="피드백을 불러오지 못했어요"
        description="잠시 후 다시 시도하거나 화면을 새로고침해 주세요."
      />
    );
  }

  const partial = bundle.feedback.status === "partial";
  const onReanalyze = () => router.refresh();

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      {/* 부분 피드백 — 가능한 항목만 표시하고 누락 사유 안내(description 예외). */}
      {partial ? (
        <Alert
          type="warning"
          showIcon
          message="일부 분석만 완료됐어요"
          description="이번 답안은 일부 항목만 분석됐어요. 아래는 완료된 결과예요. 누락된 항목은 다시 분석하면 채워질 수 있어요."
        />
      ) : null}

      <FeedbackSummary feedback={bundle.feedback} />

      <DimensionCardGrid
        rows={bundle.dimensions}
        // E-01 단답 region 2 제약: 카드 4개 이하.
        maxCards={withSentences ? undefined : 4}
        onReanalyze={onReanalyze}
      />

      {withSentences ? (
        <>
          <SentenceFeedbackList rows={bundle.sentences} onReanalyze={onReanalyze} />
          <DetailedFeedbackPanel dimensions={bundle.dimensions} />
        </>
      ) : null}

      <FeedbackRecommendationCards dimensions={bundle.dimensions} />

      <NextActionBar
        submissionId={submission.id}
        userId={userId}
        retryHref={`/writing/${submission.question_no}?problem=${submission.problem_id}`}
        nextHref="/practice/next"
        withPdf
        retryLabel={withSentences ? "다시 작성" : "다시 풀기"}
        saveLocked={saveLocked}
      />
    </Space>
  );
}
