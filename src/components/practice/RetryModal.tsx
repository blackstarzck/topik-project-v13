"use client";

import { Alert, Button, Modal, Radio, Space, Tooltip, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";

const { Paragraph, Text } = Typography;

/** 재풀이 모드 — description.md §3 (새 답안 / 이전 답안 기반 / 힌트 포함). */
type RetryMode = "fresh" | "resume" | "hint";

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
  // description.md §3: 하나는 기본 선택. 이전 답안이 있으면 '이어서'를 기본값으로.
  // RetryModal 은 ProblemListView 에서 retryTarget 별로 조건부 마운트되므로,
  // 대상이 바뀌면 컴포넌트가 새로 마운트되어 아래 초기값으로 자동 리셋된다.
  const [mode, setMode] = useState<RetryMode>(hasAttempt ? "resume" : "fresh");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  function handleStart() {
    // description.md §4: 시작 클릭 후 중복 실행 차단.
    if (starting) return;
    setStartError(null);
    if (questionNo == null) {
      // 라우트 분기 불가 — 시작 실패로 처리하고 모달 유지 (description.md §4 예외).
      setStartError("문제 유형 정보를 찾을 수 없어 시작할 수 없어요. 잠시 후 다시 시도해 주세요.");
      return;
    }
    setStarting(true);
    try {
      // 새 답안(fresh)은 fresh=1, 이어서(resume)는 저장된 draft를 그대로 로드.
      const freshParam = mode === "fresh" ? "&fresh=1" : "";
      router.push(
        `/writing/${questionNo}?problem=${problemId}${freshParam}` as never,
      );
    } catch {
      // 내비게이션 실패 시 모달 유지 + 오류/재시도 (description.md §4 예외).
      setStarting(false);
      setStartError("풀이 화면을 여는 중 문제가 발생했어요. 다시 시도해 주세요.");
    }
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
      <Paragraph type="secondary" style={{ marginBottom: 12 }}>
        이 문제에 대한 이전 기록을 찾았습니다. 어떻게 시작할까요?
      </Paragraph>

      {/* description.md §3 — 재풀이 모드 선택 (기본 선택 1개, 선택 전 시작 비활성 아님: 항상 기본값 존재) */}
      <Radio.Group
        value={mode}
        onChange={(e) => setMode(e.target.value as RetryMode)}
        style={{ width: "100%", marginBottom: 16 }}
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <Radio value="fresh">
            새 답안으로 시작{" "}
            <Text type="secondary">— 처음부터 다시 작성</Text>
          </Radio>
          <Radio value="resume" disabled={!hasAttempt}>
            이전 답안 이어서{" "}
            <Text type="secondary">
              {hasAttempt ? "— 저장된 작성 내용에서 계속" : "— 이어서 풀 답안이 없어요"}
            </Text>
          </Radio>
          {/* 힌트 포함 모드는 아직 준비 중 (deferred) — 비활성 + 정직한 안내. */}
          <Tooltip title="힌트 포함 모드는 준비 중이에요.">
            <Radio value="hint" disabled>
              힌트 포함 <Text type="secondary">— 준비 중</Text>
            </Radio>
          </Tooltip>
        </Space>
      </Radio.Group>

      {startError ? (
        // description.md §4 예외 — 시작 실패 시 모달 유지, 오류 + 재시도.
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message="시작하지 못했어요"
          description={startError}
        />
      ) : null}

      <Space direction="vertical" size="small" style={{ width: "100%" }}>
        <Button
          type="primary"
          block
          onClick={handleStart}
          loading={starting}
          disabled={starting}
        >
          {startError ? "다시 시도" : "시작"}
        </Button>
        <Button block onClick={handleViewResult} disabled={!canViewResult}>
          결과 보기
        </Button>
        <Button type="text" block onClick={onClose} disabled={starting}>
          취소
        </Button>
      </Space>
    </Modal>
  );
}
