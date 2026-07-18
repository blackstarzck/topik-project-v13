"use client";

import { Button, Descriptions, Tag, Typography } from "antd";
import { useLocale, useTranslations } from "next-intl";
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
  recoveryState: RecoveryState;
  onKeep: () => void;
  onRetry: () => void;
  onProceed: () => void;
};

function describeTrigger(
  trigger: WarningTrigger,
  recoveryState: RecoveryState,
  t: WarningTranslate,
): { title: string; body: string } {
  switch (trigger) {
    case "save_failure":
      return {
        title: t("warnSaveFailureTitle"),
        body:
          recoveryState === "possible"
            ? t("saveDelayedLocalAvailable")
            : recoveryState === "impossible"
              ? t("saveDelayedLocalUnavailable")
              : t("saveDelayedLocalChecking"),
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
      return <Tag>{t("recoveryPossible")}</Tag>;
    case "checking":
      return <Tag>{t("recoveryChecking")}</Tag>;
    case "impossible":
      return <Tag>{t("recoveryImpossible")}</Tag>;
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
  const locale = useLocale();
  const t = useTranslations("writing.autosave");
  if (!trigger) return null;
  const { title, body } = describeTrigger(trigger, recoveryState, t);

  const savedLabel = lastSavedAt
    ? new Date(lastSavedAt).toLocaleString(locale)
    : t("noSaveRecord");

  return (
    <AppModal
      open
      // §2 예외 — 경고 아이콘 로드 실패 대비: 아이콘 대신 텍스트 배지를 제목에 둔다.
      title={
        <span>
          <Tag>{t("warnBadge")}</Tag> {title}
        </span>
      }
      closable={false}
      footer={null}
      mask={{ closable: false }}
    >
      <div data-testid="autosave-warning-modal">
        <Paragraph
          data-testid="autosave-warning-body"
          className="whitespace-pre-line"
        >
          {body}
        </Paragraph>

        {/* §4 — 마지막 저장 시각(필수) + 복구 상태(가능/불가/확인중). */}
        <Descriptions
          data-testid="autosave-warning-state"
          size="small"
          column={1}
          bordered
          colon={false}
          className="mb-3"
        >
          <Descriptions.Item label={t("lastSavedLabel")}>
            <span data-testid="autosave-warning-last-saved">{savedLabel}</span>
          </Descriptions.Item>
          <Descriptions.Item label={t("recoveryStateLabel")}>
            <span data-testid="autosave-warning-recovery-state">
              {recoveryTag(recoveryState, t)}
            </span>
          </Descriptions.Item>
        </Descriptions>

        <div className="flex w-full flex-col gap-2">
          <Button block data-testid="autosave-warning-keep" onClick={onKeep}>
            {trigger === "exit_with_dirty" ? t("stayHere") : t("keepAutosave")}
          </Button>
          <Button
            block
            data-testid="autosave-warning-retry"
            type="primary"
            loading={retrying}
            onClick={onRetry}
            disabled={trigger === "disable_attempt"}
          >
            {trigger === "disable_attempt"
              ? t("retryDisabledFallback")
              : trigger === "exit_with_dirty"
                ? t("saveAndLeave")
                : t("retryNow")}
          </Button>
          <Button
            block
            danger
            data-testid="autosave-warning-proceed"
            onClick={onProceed}
          >
            <Text type="danger">
              {trigger === "disable_attempt"
                ? t("proceedDisable")
                : trigger === "exit_with_dirty"
                  ? t("leaveWithoutSaving")
                  : t("proceedAnyway")}
            </Text>
          </Button>
        </div>
      </div>
    </AppModal>
  );
}
