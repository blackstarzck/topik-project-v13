"use client";

import { App, Button } from "antd";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { triggerPdfExport } from "@/lib/export/pdf-export";

type Props = {
  sourceType: "submission" | "report";
  sourceId: string;
  /** Optional label override. Defaults to the localized "PDF로 내보내기". */
  label?: string;
  /** antd Button type. Defaults to "default" — caller picks "primary". */
  buttonType?: "default" | "primary" | "link" | "text" | "dashed";
};

export type ExportPdfClickArgs = {
  sourceType: "submission" | "report";
  sourceId: string;
};

export type ExportPdfDeps = {
  trigger: (args: ExportPdfClickArgs) => Promise<unknown>;
  notifySuccess: (msg: string) => void;
  notifyError: (msg: string) => void;
  /** Localized success toast (library.exportButton.printDialogOpened). */
  successMessage: string;
  /** Localized fallback error toast (library.exportButton.exportFailed). */
  errorMessage: string;
};

/**
 * Pure click-handler factory. Extracted so vitest can drive the export
 * sequence without rendering the component (no jsdom is configured). i18n:
 * the toast strings are passed in (deps.successMessage / deps.errorMessage)
 * because this factory is not a component and cannot call useTranslations —
 * the rendering component resolves t() and supplies them (wave-2/3 precedent).
 *
 * Contract:
 *   - calls `deps.trigger({ sourceType, sourceId })` exactly once on click;
 *   - on resolve: calls `deps.notifySuccess(deps.successMessage)`;
 *   - on reject: calls `deps.notifyError(error.message ?? deps.errorMessage)`.
 *
 * The button NEVER logs a study_events row itself — `triggerPdfExport`
 * already inserts one, and double-logging would inflate KPI counts.
 */
export function createExportPdfHandler(args: ExportPdfClickArgs, deps: ExportPdfDeps) {
  return async function onClick(): Promise<void> {
    try {
      await deps.trigger({ sourceType: args.sourceType, sourceId: args.sourceId });
      deps.notifySuccess(deps.successMessage);
    } catch (err) {
      deps.notifyError(err instanceof Error ? err.message : deps.errorMessage);
    }
  };
}

/**
 * Browser-print PDF export trigger.
 *
 * Phase 6 PDF export is `window.print()` based (see
 * `src/lib/export/pdf-export.ts`). The export_files ledger row and
 * `study_events('export_downloaded')` insert both happen inside
 * `triggerPdfExport` — this button MUST NOT log the event again to avoid
 * double-counting in the admin KPI dashboard.
 */
export function ExportPdfButton({
  sourceType,
  sourceId,
  label,
  buttonType = "default",
}: Props) {
  const t = useTranslations("library.exportButton");
  const { message } = App.useApp();
  const [pending, setPending] = useState(false);
  const resolvedLabel = label ?? t("label");

  const handler = createExportPdfHandler(
    { sourceType, sourceId },
    {
      trigger: triggerPdfExport,
      notifySuccess: (m) => message.success(m),
      notifyError: (m) => message.error(m),
      successMessage: t("printDialogOpened"),
      errorMessage: t("exportFailed"),
    },
  );

  async function handleClick() {
    setPending(true);
    try {
      await handler();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type={buttonType}
      loading={pending}
      onClick={handleClick}
      aria-label={resolvedLabel}
    >
      {pending ? t("exporting") : resolvedLabel}
    </Button>
  );
}
