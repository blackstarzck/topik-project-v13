"use client";

import { App, Button, Dropdown, type MenuProps } from "antd";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { More } from "@/components/shared/AppIcons";
import {
  exportPdfWithPrintFallback,
  getPdfExportErrorMessage,
  PdfExportApiError,
} from "@/lib/export/pdf-export-client";
import { PDF_EXPORT_ERROR_CODES } from "@/lib/export/pdf-export-errors";
import { PDF_EXPORT_DEFAULT_OPTIONS } from "@/lib/export/pdf-options";
import type {
  LibraryDraftView,
  LibraryProblemView,
  LibrarySubmissionView,
} from "@/lib/library/types";
import { APP_ROUTES } from "@/lib/routes";
import { useCreateComparisonReport } from "@/lib/writing/mutations";
import { writingProblemHref } from "@/lib/writing/routes";

type Props =
  | {
      kind: "submission";
      item: LibrarySubmissionView;
    }
  | {
      kind: "problem";
      item: LibraryProblemView;
    }
  | {
      kind: "draft";
      item: LibraryDraftView;
    };

export function LibraryProblemsActionMenu({ kind, item }: Props) {
  const t = useTranslations("library.problemsList.actionMenu");
  const tList = useTranslations("library.problemsList");
  const tSaved = useTranslations("library.saved");
  const tFeedback = useTranslations("feedback.actions");
  const router = useRouter();
  const { message, notification } = App.useApp();
  const compare = useCreateComparisonReport();
  const [open, setOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  async function onPdf() {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      const outcome = await exportPdfWithPrintFallback({
        sourceType: "submission",
        sourceId: item.id,
        options: {
          filename: tFeedback("pdfDefaultFilename"),
          ...PDF_EXPORT_DEFAULT_OPTIONS,
        },
      });
      if (outcome.mode === "file") {
        message.success(tFeedback("pdfDownloaded"));
      } else {
        message.info(tFeedback("pdfSuccess"));
      }
    } catch (err) {
      if (
        err instanceof PdfExportApiError &&
        err.code === PDF_EXPORT_ERROR_CODES.quotaExceeded
      ) {
        notification.warning({
          title: tFeedback("pdfQuotaExceededTitle"),
          description: getPdfExportErrorMessage(
            err,
            tFeedback("pdfQuotaExceededDescription"),
            {
              [PDF_EXPORT_ERROR_CODES.quotaExceeded]: tFeedback(
                "pdfQuotaExceededDescription",
              ),
            },
          ),
        });
        return;
      }
      notification.error({
        title: tFeedback("pdfFailedTitle"),
        description: tFeedback("pdfFailedDescription"),
      });
    } finally {
      setPdfBusy(false);
    }
  }

  function onCompare(submission: LibrarySubmissionView) {
    if (compare.isPending) return;
    compare.mutate(
      { current_id: submission.id },
      {
        onSuccess: ({ reportId }) => {
          router.push(`/writing/reports/${reportId}/compare`);
        },
        onError: (e) => {
          notification.error({
            title: tFeedback("compareFailedTitle"),
            description: e.message,
          });
        },
      },
    );
  }

  function menuItems(): MenuProps["items"] {
    if (kind === "problem") {
      const canRetry = item.canRetry && item.question_no !== null;
      return [
        {
          key: "retry",
          label: tSaved("retry"),
          disabled: !canRetry,
          onClick: () => {
            if (!canRetry) return;
            router.push(
              writingProblemHref({
                questionNo: item.question_no,
                problemId: item.id,
              }),
            );
          },
        },
      ];
    }

    if (kind === "draft") {
      const canContinue = item.question_no !== null;
      return [
        {
          key: "continue-draft",
          label: tList("continueDraft"),
          disabled: !canContinue,
          onClick: () => {
            if (!canContinue) return;
            router.push(
              writingProblemHref({
                questionNo: item.question_no,
                problemId: item.problem_id,
              }),
            );
          },
        },
      ];
    }

    const retryHref = writingProblemHref({
      questionNo: item.question_no,
      problemId: item.problem_id,
      fresh: true,
      retrySubmissionId: item.id,
    });

    return [
      {
        key: "export-pdf",
        label: t("exportPdf"),
        disabled: pdfBusy,
        onClick: () => void onPdf(),
      },
      {
        key: "next-problem",
        label: t("nextProblem"),
        onClick: () => router.push(APP_ROUTES.practiceNext),
      },
      {
        key: "compare-report",
        label: t("compareReport"),
        disabled: compare.isPending,
        onClick: () => onCompare(item),
      },
      {
        key: "retry",
        label: t("retry"),
        onClick: () => router.push(retryHref),
      },
    ];
  }

  return (
    <Dropdown
      menu={{ items: menuItems() }}
      trigger={["click"]}
      placement="bottomRight"
      open={open}
      onOpenChange={setOpen}
    >
      <Button
        type="text"
        size="small"
        icon={<More aria-hidden="true" size={18} />}
        aria-label={t("open")}
        aria-haspopup="menu"
        aria-expanded={open}
        title={t("open")}
      />
    </Dropdown>
  );
}
