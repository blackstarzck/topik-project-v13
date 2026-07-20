"use client";

import { Button, Descriptions, Typography } from "antd";
import { useLocale, useTranslations } from "next-intl";

import { AppModal } from "@/components/shared/AppModal";
import type { WritingRecoveryConflict } from "@/lib/writing/writing-resilience";

const { Paragraph } = Typography;
const RECOVERY_PREVIEW_MAX_CHARS = 1_000;

function recoveryPreview(answerText: string) {
  const normalized = answerText.replace(/\r\n?/gu, "\n");
  return normalized.length > RECOVERY_PREVIEW_MAX_CHARS
    ? `${normalized.slice(0, RECOVERY_PREVIEW_MAX_CHARS)}…`
    : normalized;
}

type Props = {
  choosing?: "prior" | "current" | null;
  conflict: WritingRecoveryConflict | null;
  onChoose: (choice: "prior" | "current") => void | Promise<void>;
};

export function WritingRecoveryConflictModal({
  choosing = null,
  conflict,
  onChoose,
}: Props) {
  const locale = useLocale();
  const t = useTranslations("writing.autosave");
  if (!conflict) return null;

  const formatTimestamp = (value: string | null) =>
    value ? new Date(value).toLocaleString(locale) : t("noSaveRecord");

  return (
    <AppModal
      open
      closable={false}
      footer={null}
      mask={{ closable: false }}
      title={t("recoveryConflictTitle")}
    >
      <div data-testid="writing-recovery-conflict-modal">
        <Paragraph>{t("recoveryConflictBody")}</Paragraph>
        <Descriptions bordered colon={false} column={1} size="small">
          <Descriptions.Item label={t("priorContentLabel")}>
            <div className="flex min-w-0 flex-col gap-1">
              <span
                className="text-xs text-text-secondary"
                data-testid="writing-recovery-prior-time"
              >
                {formatTimestamp(conflict.priorSavedAt)}
              </span>
              <span
                className="max-h-32 overflow-auto whitespace-pre-wrap break-words text-sm"
                data-testid="writing-recovery-prior-preview"
              >
                {recoveryPreview(conflict.prior.answerText)}
              </span>
            </div>
          </Descriptions.Item>
          <Descriptions.Item
            label={
              conflict.currentDirty
                ? t("currentEditingContentLabel")
                : t("currentContentLabel")
            }
          >
            <div className="flex min-w-0 flex-col gap-1">
              <span
                className="text-xs text-text-secondary"
                data-testid="writing-recovery-current-time"
              >
                {conflict.currentDirty
                  ? t("notSavedYet")
                  : formatTimestamp(conflict.currentSavedAt)}
              </span>
              <span
                className="max-h-32 overflow-auto whitespace-pre-wrap break-words text-sm"
                data-testid="writing-recovery-current-preview"
              >
                {recoveryPreview(conflict.current.draft.answer_text ?? "")}
              </span>
            </div>
          </Descriptions.Item>
        </Descriptions>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            data-testid="writing-recovery-choose-prior"
            disabled={choosing !== null}
            loading={choosing === "prior"}
            onClick={() => void onChoose("prior")}
          >
            {t("usePriorContent")}
          </Button>
          <Button
            data-testid="writing-recovery-choose-current"
            disabled={choosing !== null}
            loading={choosing === "current"}
            onClick={() => void onChoose("current")}
            type="primary"
          >
            {t("useCurrentContent")}
          </Button>
        </div>
      </div>
    </AppModal>
  );
}
