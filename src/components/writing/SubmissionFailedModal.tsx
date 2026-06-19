"use client";

import { Alert, Button } from "antd";
import { RefreshCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { AppModal } from "@/components/shared/AppModal";

type Props = {
  open: boolean;
  submitError: string | null;
  loading?: boolean;
  onRetry: () => void;
  onClose: () => void;
};

export function SubmissionFailedModal({
  open,
  submitError,
  loading = false,
  onRetry,
  onClose,
}: Props) {
  const t = useTranslations("writing.submit");
  const tCommon = useTranslations("common");

  return (
    <AppModal
      title={null}
      open={open}
      onCancel={onClose}
      footer={null}
      width={560}
      classNames={{ body: "p-0" }}
      centered
      closable={!loading}
      mask={{ closable: !loading }}
      keyboard={!loading}
      destroyOnHidden
    >
      <div
        className="grid gap-5 p-4 sm:p-8"
        data-testid="submission-failed-modal"
      >
        <Alert
          type="error"
          showIcon
          title={t("submitFailedTitle")}
          description={t("submitFailedDescription", {
            submitError: submitError ?? "",
          })}
        />

        <div className="grid grid-cols-[2fr_3fr] gap-3">
          <Button
            block
            size="large"
            onClick={onClose}
            disabled={loading}
            data-testid="submission-failed-close"
          >
            {tCommon("cancel")}
          </Button>
          <Button
            block
            size="large"
            type="primary"
            icon={<RefreshCcw aria-hidden size={16} />}
            onClick={onRetry}
            loading={loading}
            disabled={loading}
            data-testid="submission-failed-retry"
          >
            {t("okRetry")}
          </Button>
        </div>
      </div>
    </AppModal>
  );
}
