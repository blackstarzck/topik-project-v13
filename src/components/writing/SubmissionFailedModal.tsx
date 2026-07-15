"use client";

import { Alert, Button } from "antd";
import Link from "next/link";
import { ListChecks, RefreshCcw } from "@/components/shared/AppIcons";
import { useTranslations } from "next-intl";
import { AppModal } from "@/components/shared/AppModal";
import { APP_ROUTES } from "@/lib/routes";
import {
  classifySubmitWritingError,
  type SubmitWritingErrorKind,
} from "@/lib/writing/submit-errors";

type Props = {
  open: boolean;
  submitError: string | null;
  errorKind?: SubmitWritingErrorKind;
  loading?: boolean;
  onRetry: () => void;
  onClose: () => void;
};

export function SubmissionFailedModal({
  open,
  submitError,
  errorKind,
  loading = false,
  onRetry,
  onClose,
}: Props) {
  const t = useTranslations("writing.submit");
  const tCommon = useTranslations("common");
  const resolvedErrorKind =
    errorKind ?? classifySubmitWritingError(submitError);
  const problemUnavailable = resolvedErrorKind === "problem_unavailable";
  const submissionBlocked = resolvedErrorKind === "submission_blocked";
  const submissionAmbiguous = resolvedErrorKind === "submission_ambiguous";
  const retryBlocked = submissionBlocked || submissionAmbiguous;

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
          type={retryBlocked ? "warning" : "error"}
          showIcon
          title={t(
            submissionBlocked
              ? "submissionBlockedTitle"
              : submissionAmbiguous
                ? "submissionAmbiguousTitle"
                : "submitFailedTitle",
          )}
          description={
            submissionBlocked
              ? t("submissionBlockedDescription")
              : submissionAmbiguous
                ? t("submissionAmbiguousDescription")
                : t(
                    problemUnavailable
                      ? "submitUnavailableDescription"
                      : "submitFailedDescription",
                    { submitError: submitError ?? "" },
                  )
          }
        />

        <div
          className={
            submissionBlocked
              ? "grid grid-cols-1 gap-3"
              : "grid grid-cols-1 gap-3 sm:grid-cols-[2fr_3fr]"
          }
        >
          <Button
            block
            size="large"
            onClick={onClose}
            disabled={loading}
            data-testid="submission-failed-close"
          >
            {tCommon("cancel")}
          </Button>
          {submissionBlocked ? null : submissionAmbiguous ? (
            <Button
              block
              size="large"
              type="primary"
              href={APP_ROUTES.library as never}
              icon={<ListChecks aria-hidden size={16} />}
              disabled={loading}
              data-testid="submission-failed-history"
            >
              {t("checkSubmissionHistory")}
            </Button>
          ) : problemUnavailable ? (
            <Link href={APP_ROUTES.practiceProblems as never}>
              <Button
                block
                size="large"
                type="primary"
                icon={<ListChecks aria-hidden size={16} />}
                disabled={loading}
                data-testid="submission-failed-problem-list"
              >
                {t("chooseAnotherProblem")}
              </Button>
            </Link>
          ) : (
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
          )}
        </div>
      </div>
    </AppModal>
  );
}
