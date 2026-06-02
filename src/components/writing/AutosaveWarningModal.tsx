"use client";

import Link from "next/link";
import { Alert, Button, Descriptions, Modal, Space, Tag, Typography } from "antd";

const { Paragraph, Text } = Typography;

export type WarningTrigger =
  | "save_failure"
  | "disable_attempt"
  | "exit_with_dirty";

/** D-M3 §4 — 복구 가능 여부 tri-state. */
export type RecoveryState = "possible" | "impossible" | "checking";

type Props = {
  trigger: WarningTrigger | null;
  lastSavedAt: string | null;
  retrying?: boolean;
  /**
   * D-M3 §4 — 복구 상태(가능/불가/확인중). 미지정 시 lastSavedAt 으로 추정:
   * 저장 기록 있으면 'possible', 없으면 'impossible'.
   */
  recoveryState?: RecoveryState;
  onKeep: () => void;
  onRetry: () => void;
  onProceed: () => void;
};

function describeTrigger(
  trigger: WarningTrigger,
): { title: string; body: string; warn?: string } {
  switch (trigger) {
    case "save_failure":
      return {
        title: "자동 저장 실패",
        body: "현재 작성 중인 답안이 저장되지 않을 수 있어요. 다시 시도하거나, 답안을 복사해두는 것을 권장합니다.",
        warn: "네트워크가 끊겼다면 복구가 안 될 수 있어요.",
      };
    case "disable_attempt":
      return {
        title: "자동 저장을 끄시겠어요?",
        body: "자동 저장을 끄면 작성 중인 답안이 새로 고침이나 페이지 이동 시 사라질 수 있어요.",
      };
    case "exit_with_dirty":
      return {
        title: "저장되지 않은 변경 사항",
        body: "저장되지 않은 변경 사항이 있어요. 페이지를 나가면 작성 내용이 사라집니다.",
      };
  }
}

function recoveryTag(state: RecoveryState) {
  switch (state) {
    case "possible":
      return <Tag color="success">복구 가능</Tag>;
    case "checking":
      return <Tag color="processing">확인 중</Tag>;
    case "impossible":
      return <Tag color="error">복구 불가</Tag>;
  }
}

export function AutosaveWarningModal({
  trigger,
  lastSavedAt,
  retrying = false,
  recoveryState,
  onKeep,
  onRetry,
  onProceed,
}: Props) {
  if (!trigger) return null;
  const { title, body, warn } = describeTrigger(trigger);

  // §4 — recoveryState 미지정 시 저장 기록으로 추정.
  const recovery: RecoveryState =
    recoveryState ?? (lastSavedAt ? "possible" : "impossible");

  const savedLabel = lastSavedAt
    ? new Date(lastSavedAt).toLocaleString("ko-KR")
    : "저장 기록 없음";

  return (
    <Modal
      open
      // §2 예외 — 경고 아이콘 로드 실패 대비: 아이콘 대신 텍스트 배지를 제목에 둔다.
      title={
        <span>
          <Tag color="warning">주의</Tag> {title}
        </span>
      }
      closable={false}
      footer={null}
      maskClosable={false}
    >
      <Paragraph style={{ whiteSpace: "pre-line" }}>{body}</Paragraph>

      {/* §3 예외 — 네트워크 끊김/복구 불가 별도 경고 문구. */}
      {warn ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message={warn}
        />
      ) : null}

      {/* §4 — 마지막 저장 시각(필수) + 복구 상태(가능/불가/확인중). */}
      <Descriptions
        size="small"
        column={1}
        bordered
        colon={false}
        style={{ marginBottom: 12 }}
      >
        <Descriptions.Item label="마지막 저장:">{savedLabel}</Descriptions.Item>
        <Descriptions.Item label="복구 상태">
          {recoveryTag(recovery)}
        </Descriptions.Item>
      </Descriptions>

      {/* §4 예외 — 저장 정보 없음/복구 불가 시 도움말 링크. */}
      {recovery === "impossible" ? (
        <Paragraph type="secondary" style={{ fontSize: 12 }}>
          복구할 수 있는 임시 저장본이 없어요.{" "}
          <Link href={"/library" as never}>저장/복구 도움말 보기</Link>
        </Paragraph>
      ) : null}

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
          {trigger === "disable_attempt"
            ? "(대신 자동 저장 유지)"
            : "지금 다시 시도"}
        </Button>
        <Button block danger onClick={onProceed}>
          <Text type="danger">
            {trigger === "disable_attempt"
              ? "위험을 알지만 끄기"
              : "위험을 알지만 진행"}
          </Text>
        </Button>
      </Space>
    </Modal>
  );
}
