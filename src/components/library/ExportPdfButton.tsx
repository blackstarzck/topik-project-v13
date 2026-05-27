"use client";

import { App, Button } from "antd";
import { useState } from "react";

import { triggerPdfExport } from "@/lib/export/pdf-export";

type Props = {
  sourceType: "submission" | "report";
  sourceId: string;
  /** Optional label override. Defaults to "PDF로 내보내기". */
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
};

/**
 * Pure click-handler factory. Extracted so vitest can drive the export
 * sequence without rendering the component (no jsdom is configured).
 *
 * Contract:
 *   - calls `deps.trigger({ sourceType, sourceId })` exactly once on click;
 *   - on resolve: calls `deps.notifySuccess("PDF 출력 대화상자가 열렸습니다.")`;
 *   - on reject: calls `deps.notifyError(error.message)`.
 *
 * The button NEVER logs a study_events row itself — `triggerPdfExport`
 * already inserts one, and double-logging would inflate KPI counts.
 */
export function createExportPdfHandler(args: ExportPdfClickArgs, deps: ExportPdfDeps) {
  return async function onClick(): Promise<void> {
    try {
      await deps.trigger({ sourceType: args.sourceType, sourceId: args.sourceId });
      deps.notifySuccess("PDF 출력 대화상자가 열렸습니다.");
    } catch (err) {
      deps.notifyError(
        err instanceof Error ? err.message : "PDF 내보내기에 실패했어요.",
      );
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
  label = "PDF로 내보내기",
  buttonType = "default",
}: Props) {
  const { message } = App.useApp();
  const [pending, setPending] = useState(false);

  const handler = createExportPdfHandler(
    { sourceType, sourceId },
    {
      trigger: triggerPdfExport,
      notifySuccess: (m) => message.success(m),
      notifyError: (m) => message.error(m),
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
      aria-label={label}
    >
      {pending ? "내보내는 중..." : label}
    </Button>
  );
}
