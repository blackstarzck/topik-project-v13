"use client";

import { Button, Modal, Space, Typography } from "antd";
import { useRouter } from "next/navigation";

const { Paragraph } = Typography;

/**
 * Phase 7-D Task 5 (P1-1) — C-03 retry modal.
 *
 * Routes (현재 Tier 1 sitemap 정합):
 * - 다시 풀기 → `/writing/[questionNo]?problem=[problemId]&fresh=1`
 *   (sitemap.md line 36-39: D-01~04 글쓰기 라우트)
 * - 결과 보기 (submission 있을 때) → `/writing/feedback/short/[submissionId]`
 *   또는 `/writing/feedback/long/[submissionId]` (sitemap.md line 43-44)
 * - 결과 보기 (attempt만) → `/practice/problems` 폴백 (현재 attempt 결과 단일 페이지 없음)
 */
type Props = {
  open: boolean;
  onClose: () => void;
  problemId: string;
  /** Phase 7-D Task 5 — 라우트 분기를 위해 question_no 필요. */
  questionNo: number | null;
  /** True when there is a completed submission to view. */
  hasSubmission: boolean;
  /** True when there is an in-progress attempt but no submission yet. */
  hasAttempt: boolean;
  /** Submission id for deep link to feedback page when hasSubmission. */
  submissionId?: string;
};

function feedbackPathFor(questionNo: number | null, submissionId: string): string {
  // Short answer (51/52) → short feedback. Long form (53/54) → long feedback.
  if (questionNo === 51 || questionNo === 52) {
    return `/writing/feedback/short/${submissionId}`;
  }
  return `/writing/feedback/long/${submissionId}`;
}

export function RetryModal({
  open,
  onClose,
  problemId,
  questionNo,
  hasSubmission,
  hasAttempt,
  submissionId,
}: Props) {
  const router = useRouter();

  function handleRetry() {
    onClose();
    // Writing routes are by question_no, not problemId. Pass problemId via
    // ?problem= for the writing page to scope to the specific problem.
    if (questionNo == null) {
      router.push("/practice/problems" as never);
      return;
    }
    router.push(
      `/writing/${questionNo}?problem=${problemId}&fresh=1` as never,
    );
  }

  function handleViewResult() {
    onClose();
    if (hasSubmission && submissionId) {
      router.push(feedbackPathFor(questionNo, submissionId) as never);
      return;
    }
    // No submission id: fall back to problem list (no per-attempt result page
    // exists in the current sitemap).
    router.push("/practice/problems" as never);
  }

  const canViewResult = hasSubmission || hasAttempt;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="이전 풀이가 있어요"
      footer={null}
      destroyOnHidden
    >
      <Paragraph type="secondary" style={{ marginBottom: 16 }}>
        이 문제에 대한 이전 기록을 찾았습니다. 어떻게 할까요?
      </Paragraph>
      <Space direction="vertical" size="small" style={{ width: "100%" }}>
        <Button type="primary" block onClick={handleRetry}>
          다시 풀기
        </Button>
        <Button
          block
          onClick={handleViewResult}
          disabled={!canViewResult}
        >
          결과 보기
        </Button>
        <Button type="text" block onClick={onClose}>
          취소
        </Button>
      </Space>
    </Modal>
  );
}
