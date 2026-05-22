"use client";

import { Button, Modal, Space, Typography } from "antd";
import { useRouter } from "next/navigation";

const { Paragraph } = Typography;

type Props = {
  open: boolean;
  onClose: () => void;
  problemId: string;
  /**
   * True when there is a completed submission to view. Drives the "결과 보기"
   * button to deep-link to the feedback page.
   */
  hasSubmission: boolean;
  /**
   * True when there is an in-progress attempt but no submission yet. The
   * "결과 보기" button is still shown but routes to the attempt-result page.
   */
  hasAttempt: boolean;
  /**
   * Optional submission id used by the "결과 보기" deep link when
   * `hasSubmission` is true. When omitted but `hasSubmission` is true we fall
   * back to the problem-keyed result route.
   */
  submissionId?: string;
};

export function RetryModal({
  open,
  onClose,
  problemId,
  hasSubmission,
  hasAttempt,
  submissionId,
}: Props) {
  const router = useRouter();

  function handleRetry() {
    onClose();
    router.push(`/practice/problems/${problemId}?fresh=1` as never);
  }

  function handleViewResult() {
    onClose();
    if (hasSubmission && submissionId) {
      router.push(`/feedback/${submissionId}` as never);
      return;
    }
    if (hasSubmission) {
      // submissionId not passed — fall back to the problem-keyed result route
      // so the page can resolve the latest submission server-side.
      router.push(`/practice/problems/${problemId}/result` as never);
      return;
    }
    // hasAttempt only
    router.push(`/practice/problems/${problemId}/result` as never);
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
