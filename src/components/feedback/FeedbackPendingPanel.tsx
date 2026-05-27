"use client";

import { useFeedbackStatus } from "@/lib/writing/queries";
import { AnalysisLoadingModal } from "./AnalysisLoadingModal";

type Props = { submissionId: string };

/**
 * Phase 7-D Task 8 (P1-4) — D-M2 wired via AnalysisLoadingModal.
 * Spin + Alert만 있던 이전 단순 구조 → 캐릭터 + Steps 단계 인디케이터.
 * useFeedbackStatus은 polling을 유지해 status 변화 시 부모가 다시 렌더.
 */
export function FeedbackPendingPanel({ submissionId }: Props) {
  useFeedbackStatus(submissionId);
  return <AnalysisLoadingModal open />;
}
