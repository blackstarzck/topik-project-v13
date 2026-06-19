"use client";

import { Alert, Button } from "antd";
import { useTranslations } from "next-intl";
import { AppModal } from "@/components/shared/AppModal";

type Props = {
  open: boolean;
  charCount: number;
  minChars: number;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  questionNo?: number;
  lastSavedAt?: string | null;
  submitError?: string | null;
};

export function SubmissionConfirmModal({
  open,
  charCount,
  minChars,
  loading = false,
  onConfirm,
  onCancel,
  submitError,
}: Props) {
  const t = useTranslations("writing.submit");
  const tCommon = useTranslations("common");
  const enough = charCount >= minChars;

  if (!open) return null;

  return (
    <AppModal
      title={null}
      open={open}
      onCancel={onCancel}
      footer={null}
      width={640}
      classNames={{ body: "p-0" }}
      centered
      closable={!loading}
      mask={{ closable: !loading }}
      keyboard={!loading}
      destroyOnHidden
    >
      <div
        className="grid max-h-dvh gap-3 overflow-y-auto overscroll-contain p-3 sm:gap-4 sm:p-8"
        data-testid="submission-confirm-modal"
      >
        <div className="grid justify-items-center gap-2 text-center">
          <h2 className="m-0 text-xl font-bold leading-tight text-text sm:text-2xl">
            {t("title")}
          </h2>
          <p className="m-0 max-w-md text-xs text-text-secondary sm:text-sm">
            {t("subtitle")}
          </p>
        </div>

        {!enough ? (
          <Alert
            type="warning"
            showIcon
            title={t("notEnoughChars", { minChars })}
          />
        ) : null}

        {submitError ? (
          <Alert
            type="error"
            showIcon
            title={t("submitFailedTitle")}
            description={t("submitFailedDescription", { submitError })}
          />
        ) : null}

        <div className="mt-8 grid grid-cols-[2fr_3fr] gap-3">
          <Button
            block
            size="large"
            onClick={onCancel}
            disabled={loading}
            data-testid="submission-confirm-cancel"
          >
            {tCommon("cancel")}
          </Button>
          <Button
            block
            size="large"
            type="primary"
            onClick={onConfirm}
            disabled={!enough || loading}
            loading={loading}
            data-testid="submission-confirm-submit"
          >
            {submitError ? t("okRetry") : t("ok")}
          </Button>
        </div>
      </div>
    </AppModal>
  );
}
