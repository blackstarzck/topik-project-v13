"use client";

import {
  Alert,
  Button,
  Descriptions,
  Modal,
  Radio,
  Space,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";

const { Paragraph, Text } = Typography;

/** 재풀이 모드 — description.md §3 (새 답안 / 이전 답안 기반 / 힌트 포함). */
type RetryMode = "fresh" | "resume" | "hint";

/**
 * C-03 다시 풀기 모달.
 *
 * Routes:
 * - 다시 풀기 → `/writing/[questionNo]?problem=[problemId]&fresh=1`
 * - 결과 보기 (submission 있을 때) → `/writing/feedback/{short|long}/[submissionId]`
 *   submissionId 는 모달 열림 시 problem_attempts/writing_submissions 에서 lazy 조회.
 */
type Props = {
  open: boolean;
  onClose: () => void;
  problemId: string;
  /** C-03 §2 — 문제 제목 요약. */
  problemTitle?: string;
  /** 라우트 분기 + §2 유형 표시를 위해 question_no 필요. */
  questionNo: number | null;
  /** C-03 §2 — 이전 풀이 상태 요약: 시도 횟수. */
  attemptCount?: number;
  /** C-03 §2 — 마지막 시도 시각(ISO). */
  lastAttemptAt?: string | null;
  /** True when there is a completed submission to view. */
  hasSubmission: boolean;
  /** True when there is an in-progress attempt but no submission yet. */
  hasAttempt: boolean;
  /**
   * Submission id for the "결과 보기" deep link when already known by the caller.
   * When omitted (e.g. RPC list path), the modal resolves the latest submission
   * id lazily from writing_submissions on click.
   */
  submissionId?: string;
  /**
   * C-03 §2 예외 — 문제 만료 시 시작 대신 만료 안내 + 닫기만 제공.
   * 현재 problems 스키마에 만료 컬럼이 없어 기본 false; 추천 만료(run.expires_at)
   * 등 상위에서 만료를 판단해 주입하는 seam.
   */
  expired?: boolean;
};

function feedbackPathFor(questionNo: number | null, submissionId: string): string {
  if (questionNo === 51 || questionNo === 52) {
    return `/writing/feedback/short/${submissionId}`;
  }
  return `/writing/feedback/long/${submissionId}`;
}

function relativeDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const days = Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "오늘";
  if (days === 1) return "어제";
  if (days < 7) return `${days}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

export function RetryModal({
  open,
  onClose,
  problemId,
  problemTitle,
  questionNo,
  attemptCount = 0,
  lastAttemptAt,
  hasSubmission,
  hasAttempt,
  submissionId,
  expired = false,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<RetryMode>(hasAttempt ? "resume" : "fresh");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  function handleStart() {
    // §4 — 시작 클릭 후 중복 실행 차단.
    if (starting) return;
    setStartError(null);
    if (questionNo == null) {
      setStartError(
        "문제 유형 정보를 찾을 수 없어 시작할 수 없어요. 잠시 후 다시 시도해 주세요.",
      );
      return;
    }
    setStarting(true);
    try {
      const freshParam = mode === "fresh" ? "&fresh=1" : "";
      router.push(
        `/writing/${questionNo}?problem=${problemId}${freshParam}` as never,
      );
    } catch {
      setStarting(false);
      setStartError("풀이 화면을 여는 중 문제가 발생했어요. 다시 시도해 주세요.");
    }
  }

  function handleViewResult() {
    onClose();
    // caller 가 submissionId 를 주면 피드백으로 deep-link, 없으면 목록 폴백.
    if (hasSubmission && submissionId) {
      router.push(feedbackPathFor(questionNo, submissionId) as never);
      return;
    }
    router.push("/practice/problems" as never);
  }

  const canViewResult = hasSubmission;
  const lastLabel = relativeDay(lastAttemptAt);

  // §2 — 이전 풀이 상태 요약 라벨.
  const statusLabel = hasSubmission
    ? "제출 완료"
    : hasAttempt
      ? "작성 중(임시 저장)"
      : "기록 없음";

  const summary = (
    <Descriptions size="small" column={1} bordered style={{ marginBottom: 16 }}>
      <Descriptions.Item label="문제">
        {(problemTitle ?? "선택한 문제").slice(0, 28)}
      </Descriptions.Item>
      <Descriptions.Item label="유형">
        {questionNo ? <Tag>{questionNo}번</Tag> : "—"}
      </Descriptions.Item>
      <Descriptions.Item label="이전 상태">
        {statusLabel}
        {attemptCount > 0 ? ` · 시도 ${attemptCount}회` : ""}
        {lastLabel ? ` · ${lastLabel}` : ""}
      </Descriptions.Item>
    </Descriptions>
  );

  // §1 예외 — 위험 상태(시작 처리 중)에서는 배경 클릭/ESC 닫기 비활성.
  const risky = starting;

  // §2 예외 — 만료된 문제: 시작/모드 선택 숨기고 만료 안내 + 닫기만.
  if (expired) {
    return (
      <Modal
        open={open}
        onCancel={onClose}
        title="다시 풀 수 없는 문제예요"
        footer={null}
        maskClosable
        destroyOnHidden
      >
        {summary}
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="이 문제는 만료되어 더 이상 풀 수 없어요."
          description="다른 문제를 골라 학습을 이어가 보세요."
        />
        <Button block onClick={onClose}>
          닫기
        </Button>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onCancel={risky ? undefined : onClose}
      title="이전 풀이가 있어요"
      footer={null}
      maskClosable={!risky}
      keyboard={!risky}
      destroyOnHidden
    >
      {summary}

      <Paragraph type="secondary" style={{ marginBottom: 12 }}>
        이 문제에 대한 이전 기록을 찾았습니다. 어떻게 시작할까요?
      </Paragraph>

      {/* §3 — 재풀이 모드 선택 (기본 선택 1개 항상 존재). */}
      <Radio.Group
        value={mode}
        onChange={(e) => setMode(e.target.value as RetryMode)}
        style={{ width: "100%", marginBottom: 16 }}
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <Radio value="fresh">
            새 답안으로 시작 <Text type="secondary">— 처음부터 다시 작성</Text>
          </Radio>
          <Radio value="resume" disabled={!hasAttempt}>
            이전 답안 이어서{" "}
            <Text type="secondary">
              {hasAttempt
                ? "— 저장된 작성 내용에서 계속"
                : "— 이어서 풀 답안이 없어요"}
            </Text>
          </Radio>
          {/* 힌트 포함 모드는 아직 준비 중(deferred) — 비활성 + 정직한 안내. */}
          <Tooltip title="힌트 포함 모드는 준비 중이에요.">
            <Radio value="hint" disabled>
              힌트 포함 <Text type="secondary">— 준비 중</Text>
            </Radio>
          </Tooltip>
        </Space>
      </Radio.Group>

      {startError ? (
        // §4 예외 — 시작 실패 시 모달 유지, 오류 + 재시도.
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message="진행하지 못했어요"
          description={startError}
        />
      ) : null}

      <Space direction="vertical" size="small" style={{ width: "100%" }}>
        <Button
          type="primary"
          block
          onClick={handleStart}
          loading={starting}
          disabled={risky}
        >
          {startError ? "다시 시도" : "시작"}
        </Button>
        <Button block onClick={handleViewResult} disabled={!canViewResult || risky}>
          결과 보기
        </Button>
        <Button type="text" block onClick={onClose} disabled={risky}>
          취소
        </Button>
      </Space>
    </Modal>
  );
}
