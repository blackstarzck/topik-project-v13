"use client";

import { App, Button } from "antd";
import { useTranslations } from "next-intl";

import {
  exportPdfWithPrintFallback,
  getPdfExportErrorMessage,
  PdfExportApiError,
} from "@/lib/export/pdf-export-client";
import {
  PDF_EXPORT_ERROR_CODES,
  type PdfExportErrorCode,
} from "@/lib/export/pdf-export-errors";
import {
  PDF_EXPORT_DEFAULT_OPTIONS,
  type PdfExportRequest,
} from "@/lib/export/pdf-options";
import { useSingleFlightAction } from "@/lib/request-control/useSingleFlightAction";

type Props = {
  sourceType: "submission" | "report";
  sourceId: string;
  /** Optional label override. Defaults to the localized "PDF로 내보내기". */
  label?: string;
  /** antd Button type. Defaults to "default" — caller picks "primary". */
  buttonType?: "default" | "primary" | "link" | "text" | "dashed";
  disabled?: boolean;
  ariaDescribedBy?: string;
};

export type ExportPdfClickArgs = {
  sourceType: "submission" | "report";
  sourceId: string;
};

export type ExportPdfOutcome = {
  mode: "file" | "print";
  exportId: string;
};

export type ExportPdfDeps = {
  trigger: (args: ExportPdfClickArgs) => Promise<ExportPdfOutcome>;
  notifySuccess: (msg: string) => void;
  notifyWarning: (msg: string) => void;
  notifyError: (msg: string) => void;
  /** Localized file-downloaded toast (library.exportButton.downloaded). */
  downloadedMessage: string;
  /** Localized print-fallback notice (library.exportButton.fallbackPrint). */
  printFallbackMessage: string;
  /** Localized fallback error toast (library.exportButton.exportFailed). */
  errorMessage: string;
  /** Optional localized API business-rule messages keyed by stable error code. */
  errorMessagesByCode?: Partial<Record<PdfExportErrorCode, string>>;
  /** Business-rule codes that should be shown as warning, not failure. */
  warningCodes?: PdfExportErrorCode[];
};

/**
 * Pure click-handler factory. Extracted so vitest can drive the export
 * sequence without rendering the component (no jsdom is configured). i18n:
 * the toast strings are passed in because this factory is not a component
 * and cannot call useTranslations — the rendering component resolves t()
 * and supplies them (wave-2/3 precedent).
 *
 * Contract:
 *   - calls `deps.trigger({ sourceType, sourceId })` exactly once on click;
 *   - mode='file' (서버 실파일 다운로드) → notifySuccess(downloadedMessage);
 *   - mode='print' (브라우저 인쇄 폴백) → notifyWarning(printFallbackMessage);
 *   - on reject: notifyError(errorMessage) without exposing raw details.
 *
 * The button NEVER logs a study_events row itself — the export pipeline
 * (server route / triggerPdfExport) already inserts one, and double-logging
 * would inflate KPI counts.
 */
export function createExportPdfHandler(
  args: ExportPdfClickArgs,
  deps: ExportPdfDeps,
) {
  return async function onClick(): Promise<void> {
    try {
      const outcome = await deps.trigger({
        sourceType: args.sourceType,
        sourceId: args.sourceId,
      });
      if (outcome.mode === "print") {
        deps.notifyWarning(deps.printFallbackMessage);
        return;
      }
      deps.notifySuccess(deps.downloadedMessage);
    } catch (err) {
      const message = getPdfExportErrorMessage(
        err,
        deps.errorMessage,
        deps.errorMessagesByCode,
      );
      if (
        err instanceof PdfExportApiError &&
        deps.warningCodes?.includes(err.code as PdfExportErrorCode)
      ) {
        deps.notifyWarning(message);
        return;
      }
      deps.notifyError(message);
    }
  };
}

/**
 * 실파일 PDF 내보내기 트리거 (F-M1 서버 생성 — 브리프 2026-06-12).
 *
 * 서버가 PDF를 생성해 generated-exports에 저장하고 바로 다운로드한다.
 * 서버 생성이 실패하면 기존 브라우저 인쇄(window.print)로 폴백한다(§3-B).
 */
export function ExportPdfButton({
  sourceType,
  sourceId,
  label,
  buttonType = "default",
  disabled = false,
  ariaDescribedBy,
}: Props) {
  const t = useTranslations("library.exportButton");
  const { message } = App.useApp();
  const resolvedLabel = label ?? t("label");

  const handler = createExportPdfHandler(
    { sourceType, sourceId },
    {
      trigger: (args) => {
        const request: PdfExportRequest = {
          sourceType: args.sourceType,
          sourceId: args.sourceId,
          options: {
            filename:
              args.sourceType === "report"
                ? t("defaultFilenameReport")
                : t("defaultFilenameSubmission"),
            ...PDF_EXPORT_DEFAULT_OPTIONS,
          },
        };
        return exportPdfWithPrintFallback(request);
      },
      notifySuccess: (m) => message.success(m),
      notifyWarning: (m) => message.warning(m),
      notifyError: (m) => message.error(m),
      downloadedMessage: t("downloaded"),
      printFallbackMessage: t("fallbackPrint"),
      errorMessage: t("exportFailed"),
      errorMessagesByCode: {
        [PDF_EXPORT_ERROR_CODES.failedAnalysisUnavailable]: t(
          "failedAnalysisExportUnavailable",
        ),
        [PDF_EXPORT_ERROR_CODES.quotaExceeded]: t("quotaExceeded"),
      },
      warningCodes: [PDF_EXPORT_ERROR_CODES.quotaExceeded],
    },
  );

  const exportAction = useSingleFlightAction(handler);

  return (
    <Button
      type={buttonType}
      loading={exportAction.pending}
      disabled={disabled || exportAction.pending}
      onClick={() => void exportAction.run()}
      aria-label={resolvedLabel}
      aria-describedby={ariaDescribedBy}
    >
      {exportAction.pending ? t("exporting") : resolvedLabel}
    </Button>
  );
}
