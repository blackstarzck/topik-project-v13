"use client";

import { Button, Modal, Space, Typography } from "antd";

const { Paragraph, Text } = Typography;

export type WarningTrigger =
  | "save_failure"
  | "disable_attempt"
  | "exit_with_dirty";

type Props = {
  trigger: WarningTrigger | null;
  lastSavedAt: string | null;
  retrying?: boolean;
  onKeep: () => void;
  onRetry: () => void;
  onProceed: () => void;
};

function describeTrigger(
  trigger: WarningTrigger,
  lastSavedAt: string | null,
): { title: string; body: string } {
  const lastSavedLine = lastSavedAt
    ? `마지막 저장: ${new Date(lastSavedAt).toLocaleString("ko-KR")}`
    : "마지막 저장 기록이 없습니다.";
  switch (trigger) {
    case "save_failure":
      return {
        title: "⚠ 자동 저장 실패",
        body: `${lastSavedLine}\n현재 작성 중인 답안이 저장되지 않을 수 있습니다. 다시 시도하거나, 답안을 복사해두는 것을 권장합니다.`,
      };
    case "disable_attempt":
      return {
        title: "⚠ 자동 저장을 끄시겠어요?",
        body: "자동 저장을 끄면 작성 중인 답안이 새로 고침이나 페이지 이동 시 사라질 수 있습니다.",
      };
    case "exit_with_dirty":
      return {
        title: "⚠ 저장되지 않은 변경 사항",
        body: `${lastSavedLine}\n저장되지 않은 변경 사항이 있습니다. 페이지를 나가면 작성 내용이 사라집니다.`,
      };
  }
}

export function AutosaveWarningModal({
  trigger,
  lastSavedAt,
  retrying = false,
  onKeep,
  onRetry,
  onProceed,
}: Props) {
  if (!trigger) return null;
  const { title, body } = describeTrigger(trigger, lastSavedAt);
  return (
    <Modal
      open
      title={title}
      closable={false}
      footer={null}
      maskClosable={false}
    >
      <Paragraph style={{ whiteSpace: "pre-line" }}>{body}</Paragraph>
      <Space direction="vertical" style={{ width: "100%" }}>
        <Button block onClick={onKeep}>
          자동 저장 유지
        </Button>
        <Button
          block
          type="primary"
          loading={retrying}
          onClick={onRetry}
          disabled={trigger === "disable_attempt"}
        >
          {trigger === "disable_attempt" ? "(대신 자동 저장 유지)" : "지금 다시 시도"}
        </Button>
        <Button block danger onClick={onProceed}>
          <Text type="danger">위험을 알지만 진행</Text>
        </Button>
      </Space>
    </Modal>
  );
}
