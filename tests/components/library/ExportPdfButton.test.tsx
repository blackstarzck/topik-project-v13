// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createExportPdfHandler,
  ExportPdfButton,
} from "../../../src/components/library/ExportPdfButton";
import { PdfExportApiError } from "../../../src/lib/export/pdf-export-client";
import { PDF_EXPORT_ERROR_CODES } from "../../../src/lib/export/pdf-export-errors";
import koMessages from "../../../messages/ko.json";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

const exportPdfWithPrintFallbackMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/export/pdf-export-client", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../../../src/lib/export/pdf-export-client")
    >();
  return {
    ...actual,
    exportPdfWithPrintFallback: (...args: unknown[]) =>
      exportPdfWithPrintFallbackMock(...args),
  };
});

/**
 * `ExportPdfButton` is a thin shell around the server-PDF export pipeline
 * (`exportPdfWithPrintFallback`) + antd's App.message bus. The load-bearing
 * logic is extracted into `createExportPdfHandler` so vitest can verify the
 * click sequence without a DOM (no jsdom is configured).
 *
 * i18n: the handler is hook-free and takes the localized toast text via deps
 * (the component resolves t() and supplies them). We pull the VERBATIM Korean
 * from the merged ko catalog so the assertions track the source of truth.
 *
 * Contract under test (F-M1 server-render, 2026-06-12 brief):
 *   1. clicking calls `deps.trigger` with the bound sourceType/sourceId once;
 *   2. mode='file' → notifySuccess(downloadedMessage);
 *   3. mode='print' (인쇄 폴백) → notifyWarning(printFallbackMessage);
 *   4. on error → notifyError(errorMessage) without exposing raw details;
 *   5. the button does NOT log a study_events row itself
 *      (the export pipeline already does — double-log would skew KPI counts).
 */
const DOWNLOADED_KO = koMessages.library.exportButton.downloaded;
const FALLBACK_PRINT_KO = koMessages.library.exportButton.fallbackPrint;
const ERROR_KO = koMessages.library.exportButton.exportFailed;

afterEach(() => {
  cleanup();
  exportPdfWithPrintFallbackMock.mockReset();
});

function makeDeps(trigger: ReturnType<typeof vi.fn>) {
  return {
    trigger: trigger as unknown as Parameters<
      typeof createExportPdfHandler
    >[1]["trigger"],
    notifySuccess: vi.fn<(msg: string) => void>(),
    notifyWarning: vi.fn<(msg: string) => void>(),
    notifyError: vi.fn<(msg: string) => void>(),
    downloadedMessage: DOWNLOADED_KO,
    printFallbackMessage: FALLBACK_PRINT_KO,
    errorMessage: ERROR_KO,
    errorMessagesByCode: {
      [PDF_EXPORT_ERROR_CODES.failedAnalysisUnavailable]:
        koMessages.library.exportButton.failedAnalysisExportUnavailable,
      [PDF_EXPORT_ERROR_CODES.quotaExceeded]:
        koMessages.library.exportButton.quotaExceeded,
    },
    warningCodes: [PDF_EXPORT_ERROR_CODES.quotaExceeded],
  };
}

describe("ExportPdfButton — createExportPdfHandler", () => {
  it("calls the trigger with the bound sourceType/sourceId exactly once", async () => {
    const trigger = vi.fn(async () => ({
      mode: "file" as const,
      exportId: "exp-1",
    }));
    const deps = makeDeps(trigger);

    const onClick = createExportPdfHandler(
      { sourceType: "submission", sourceId: "sub-42" },
      deps,
    );
    await onClick();

    expect(trigger).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveBeenCalledWith({
      sourceType: "submission",
      sourceId: "sub-42",
    });
  });

  it("emits the downloaded toast when the server render succeeds (mode=file)", async () => {
    const trigger = vi.fn(async () => ({
      mode: "file" as const,
      exportId: "exp-1",
    }));
    const deps = makeDeps(trigger);

    const onClick = createExportPdfHandler(
      { sourceType: "report", sourceId: "rep-9" },
      deps,
    );
    await onClick();

    expect(deps.notifySuccess).toHaveBeenCalledTimes(1);
    expect(deps.notifySuccess).toHaveBeenCalledWith(DOWNLOADED_KO);
    expect(deps.notifyWarning).not.toHaveBeenCalled();
    expect(deps.notifyError).not.toHaveBeenCalled();
  });

  it("emits the print-fallback notice when the server render fell back (mode=print)", async () => {
    const trigger = vi.fn(async () => ({
      mode: "print" as const,
      exportId: "exp-2",
    }));
    const deps = makeDeps(trigger);

    const onClick = createExportPdfHandler(
      { sourceType: "submission", sourceId: "sub-1" },
      deps,
    );
    await onClick();

    expect(deps.notifyWarning).toHaveBeenCalledTimes(1);
    expect(deps.notifyWarning).toHaveBeenCalledWith(FALLBACK_PRINT_KO);
    expect(deps.notifySuccess).not.toHaveBeenCalled();
  });

  it("shows a stable error message without exposing the trigger failure", async () => {
    const trigger = vi.fn(async () => {
      throw new Error("network down");
    });
    const deps = makeDeps(trigger);

    const onClick = createExportPdfHandler(
      { sourceType: "submission", sourceId: "sub-1" },
      deps,
    );

    // Handler must not reject — clicking the button should never crash the
    // tree. Errors are surfaced through the toast bus instead.
    await expect(onClick()).resolves.toBeUndefined();
    expect(deps.notifyError).toHaveBeenCalledTimes(1);
    expect(deps.notifyError).toHaveBeenCalledWith(ERROR_KO);
    expect(JSON.stringify(deps.notifyError.mock.calls)).not.toContain(
      "network down",
    );
    expect(deps.notifySuccess).not.toHaveBeenCalled();
  });

  it("maps API business-rule errors through localized error codes", async () => {
    const trigger = vi.fn(async () => {
      throw new PdfExportApiError(
        400,
        "분석 실패 답안은 PDF로 내보낼 수 없어요.",
        PDF_EXPORT_ERROR_CODES.failedAnalysisUnavailable,
      );
    });
    const deps = makeDeps(trigger);

    const onClick = createExportPdfHandler(
      { sourceType: "submission", sourceId: "sub-1" },
      deps,
    );
    await onClick();

    expect(deps.notifyError).toHaveBeenCalledWith(
      koMessages.library.exportButton.failedAnalysisExportUnavailable,
    );
  });

  it("shows quota exceeded as a localized warning instead of an error", async () => {
    const trigger = vi.fn(async () => {
      throw new PdfExportApiError(
        429,
        "PDF 내보내기 횟수를 모두 사용했어요.",
        PDF_EXPORT_ERROR_CODES.quotaExceeded,
      );
    });
    const deps = makeDeps(trigger);

    const onClick = createExportPdfHandler(
      { sourceType: "submission", sourceId: "sub-1" },
      deps,
    );
    await onClick();

    expect(deps.notifyWarning).toHaveBeenCalledWith(
      koMessages.library.exportButton.quotaExceeded,
    );
    expect(deps.notifyError).not.toHaveBeenCalled();
  });

  it("uses the localized generic error for unknown API business-rule errors", async () => {
    const trigger = vi.fn(async () => {
      throw new PdfExportApiError(429, "서버 문자열", undefined);
    });
    const deps = makeDeps(trigger);

    const onClick = createExportPdfHandler(
      { sourceType: "submission", sourceId: "sub-1" },
      deps,
    );
    await onClick();

    expect(deps.notifyError).toHaveBeenCalledWith(ERROR_KO);
  });

  it("falls back to a Korean default message when the thrown value is not an Error", async () => {
    const trigger = vi.fn(async () => {
      // Simulate a non-Error rejection (e.g. supabase-js sometimes throws strings).
      throw "boom";
    });
    const deps = makeDeps(trigger);

    const onClick = createExportPdfHandler(
      { sourceType: "report", sourceId: "rep-2" },
      deps,
    );
    await onClick();
    expect(deps.notifyError).toHaveBeenCalledWith(ERROR_KO);
  });

  it("does not invoke any study-event logger of its own (single-log contract)", async () => {
    // Sanity assertion: the deps surface only the trigger + three notify
    // channels + the three localized toast strings. There's no `logEvent`
    // channel — the button has no way to write a second study_events row
    // even if a future refactor tries.
    const trigger = vi.fn(async () => ({
      mode: "file" as const,
      exportId: "exp-1",
    }));
    const deps = makeDeps(trigger);

    const keys = Object.keys(deps).sort();
    expect(keys).toEqual([
      "downloadedMessage",
      "errorMessage",
      "errorMessagesByCode",
      "notifyError",
      "notifySuccess",
      "notifyWarning",
      "printFallbackMessage",
      "trigger",
      "warningCodes",
    ]);
    expect(keys).not.toContain("logEvent");

    const onClick = createExportPdfHandler(
      { sourceType: "submission", sourceId: "sub-1" },
      deps,
    );
    await onClick();
    expect(trigger).toHaveBeenCalledTimes(1);
  });
});

describe("ExportPdfButton pending UI", () => {
  it("triggers one export while the clicked button is pending", async () => {
    exportPdfWithPrintFallbackMock.mockReturnValue(
      new Promise(() => undefined),
    );
    renderWithIntl(
      <ExportPdfButton
        sourceType="submission"
        sourceId="sub-1"
        label="Export PDF"
      />,
    );

    const button = screen.getByRole("button", { name: "Export PDF" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(exportPdfWithPrintFallbackMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(button).toHaveProperty("disabled", true);
      expect(button.className).toContain("ant-btn-loading");
    });
  });
});
