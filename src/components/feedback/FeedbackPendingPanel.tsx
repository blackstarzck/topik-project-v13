"use client";

import { useRouter } from "next/navigation";
import { useFeedbackStatus } from "@/lib/writing/queries";
import { AnalysisLoadingModal, type AnalysisPhase } from "./AnalysisLoadingModal";

type Props = {
  submissionId: string;
  /**
   * 분석 완료 시 새로고침해 실제 피드백을 보여줄 현재 경로. 단답/장문 페이지가
   * 각자 자기 경로를 넘긴다. 지정 시 complete에서 router.refresh로 RSC를 다시
   * 불러온다(클라이언트 라우팅이라 전체 reload 없이 서버 fetch만 갱신).
   */
  reloadHref?: string | null;
  /** 초기 서버 상태. polling이 시작되기 전 첫 프레임에 사용. */
  initialStatus?: AnalysisPhase;
};

/**
 * D-M2 wired via AnalysisLoadingModal.
 *
 * useFeedbackStatus는 status가 complete/failed가 될 때까지 polling한다. status를
 * 그대로 모달에 넘겨:
 *   - failed  → 무한 로딩 STOP, 실패 안내 + 재시도
 *   - complete→ router.refresh()로 RSC 재요청 → 부모가 실제 피드백 렌더
 *   - 그 외   → 단계 진행 표시
 *
 * 실제 AI 워커(외부 leg)는 status를 옮길 책임이 있고, 본 패널은 표시만 한다.
 */
export function FeedbackPendingPanel({
  submissionId,
  reloadHref,
  initialStatus = "pending",
}: Props) {
  const router = useRouter();
  const { data } = useFeedbackStatus(submissionId);
  const status: AnalysisPhase = (data as AnalysisPhase | null) ?? initialStatus;

  return (
    <AnalysisLoadingModal
      open
      status={status}
      // complete면 현재 RSC를 다시 불러와 실제 피드백을 그린다. reloadHref가 현재
      // 경로면 replace보다 refresh가 정확하므로 onComplete를 우선 사용한다.
      onComplete={() => router.refresh()}
      completeHref={reloadHref ?? null}
      onRetry={() => router.refresh()}
    />
  );
}
