"use client";

import Link from "next/link";
import { Alert, Button, Descriptions, Space, Tag, Typography } from "antd";
import { useTranslations } from "next-intl";
import { AppModal } from "@/components/shared/AppModal";

const { Paragraph, Text } = Typography;

type WarningTranslate = ReturnType<typeof useTranslations<"writing.autosave">>;

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
  t: WarningTranslate,
): { title: string; body: string; warn?: string } {
  switch (trigger) {
    case "save_failure":
      return {
        title: t("warnSaveFailureTitle"),
        body: t("warnSaveFailureBody"),
        warn: t("warnSaveFailureWarn"),
      };
    case "disable_attempt":
      return {
        title: t("warnDisableTitle"),
        body: t("warnDisableBody"),
      };
    case "exit_with_dirty":
      return {
        title: t("warnExitTitle"),
        body: t("warnExitBody"),
      };
  }
}

function recoveryTag(state: RecoveryState, t: WarningTranslate) {
  switch (state) {
    case "possible":
      return <Tag color="success">{t("recoveryPossible")}</Tag>;
    case "checking":
      return <Tag color="processing">{t("recoveryChecking")}</Tag>;
    case "impossible":
      return <Tag color="error">{t("recoveryImpossible")}</Tag>;
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
  const t = useTranslations("writing.autosave");
  if (!trigger) return null;
  const { title, body, warn } = describeTrigger(trigger, t);

  // §4 — recoveryState 미지정 시 저장 기록으로 추정.
  const recovery: RecoveryState =
    recoveryState ?? (lastSavedAt ? "possible" : "impossible");

  const savedLabel = lastSavedAt
    ? new Date(lastSavedAt).toLocaleString("ko-KR")
    : t("noSaveRecord");

  return (
    <AppModal
      open
      // §2 예외 — 경고 아이콘 로드 실패 대비: 아이콘 대신 텍스트 배지를 제목에 둔다.
      title={
        <span>
          <Tag color="warning">{t("warnBadge")}</Tag> {title}
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
        <Descriptions.Item label={t("lastSavedLabel")}>{savedLabel}</Descriptions.Item>
        <Descriptions.Item label={t("recoveryStateLabel")}>
          {recoveryTag(recovery, t)}
        </Descriptions.Item>
      </Descriptions>

      {/* §4 예외 — 저장 정보 없음/복구 불가 시 도움말 링크. */}
      {recovery === "impossible" ? (
        <Paragraph type="secondary" style={{ fontSize: 12 }}>
          {t("noBackup")}{" "}
          <Link href={"/library" as never}>{t("backupHelpLink")}</Link>
        </Paragraph>
      ) : null}

      <Space direction="vertical" style={{ width: "100%" }}>
        <Button block onClick={onKeep}>
          {t("keepAutosave")}
        </Button>
        <Button
          block
          type="primary"
          loading={retrying}
          onClick={onRetry}
          disabled={trigger === "disable_attempt"}
        >
          {trigger === "disable_attempt"
            ? t("retryDisabledFallback")
            : t("retryNow")}
        </Button>
        <Button block danger onClick={onProceed}>
          <Text type="danger">
            {trigger === "disable_attempt"
              ? t("proceedDisable")
              : t("proceedAnyway")}
          </Text>
        </Button>
      </Space>
    </AppModal>
  );
}
