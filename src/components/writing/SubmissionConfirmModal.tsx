"use client";

import { useState } from "react";
import { Alert, Checkbox, Descriptions, Modal, Typography } from "antd";

const { Paragraph, Text } = Typography;

type Props = {
  open: boolean;
  charCount: number;
  minChars: number;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** D-M1 제출 요약 — 문제 유형 표시 (예: 51). */
  questionNo?: number;
  /** D-M1 제출 요약 — 마지막 자동 저장 시각(ISO). */
  lastSavedAt?: string | null;
};

export function SubmissionConfirmModal({
  open,
  charCount,
  minChars,
  loading = false,
  onConfirm,
  onCancel,
  questionNo,
  lastSavedAt,
}: Props) {
  const enough = charCount >= minChars;
  // description.md §3 — 동의 체크. Modal destroyOnClose 로 닫힐 때 언마운트되어
  // 다시 열면 useState 초기값(false)으로 자동 초기화된다.
  const [agreed, setAgreed] = useState(false);

  const savedLabel = lastSavedAt
    ? new Date(lastSavedAt).toLocaleString("ko-KR")
    : "자동 저장 기록 없음";

  return (
    <Modal
      title="답안을 제출하시겠어요?"
      open={open}
      onOk={onConfirm}
      onCancel={onCancel}
      okText="제출"
      cancelText="취소"
      okButtonProps={{ disabled: !enough || !agreed || loading, loading }}
      destroyOnClose
    >
      {/* description.md §2 제출 요약 — 문제 유형 / 답안 길이 / 저장 시각 (3항목). */}
      <Descriptions size="small" column={1} bordered style={{ marginBottom: 12 }}>
        {questionNo ? (
          <Descriptions.Item label="문제 유형">{questionNo}번</Descriptions.Item>
        ) : null}
        <Descriptions.Item label="답안 길이">
          <Text strong type={enough ? "success" : "danger"}>
            {charCount}자
          </Text>{" "}
          (최소 {minChars}자)
        </Descriptions.Item>
        <Descriptions.Item label="마지막 저장">{savedLabel}</Descriptions.Item>
      </Descriptions>

      <Paragraph>
        제출 후에는 답안을 수정할 수 없고, 자동으로 AI 분석이 시작됩니다. 분석에는
        잠시 대기 시간이 걸릴 수 있어요.
      </Paragraph>

      {!enough ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message={`아직 최소 글자 수(${minChars}자)에 도달하지 않았어요.`}
        />
      ) : null}

      {/* description.md §3 — 동의 체크. 체크 전에는 제출 비활성. */}
      <Checkbox
        checked={agreed}
        onChange={(e) => setAgreed(e.target.checked)}
      >
        제출 후 수정할 수 없음을 확인했어요.
      </Checkbox>
    </Modal>
  );
}
