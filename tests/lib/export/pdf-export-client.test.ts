import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  exportPdfWithPrintFallback,
  PdfExportApiError,
} from "../../../src/lib/export/pdf-export-client";
import { PDF_EXPORT_ERROR_CODES } from "../../../src/lib/export/pdf-export-errors";
import { triggerPdfExport } from "../../../src/lib/export/pdf-export";
import { PDF_EXPORT_DEFAULT_OPTIONS } from "../../../src/lib/export/pdf-options";

vi.mock("../../../src/lib/export/pdf-export", () => ({
  triggerPdfExport: vi.fn(),
}));

const request = {
  sourceType: "submission",
  sourceId: "00000000-0000-4000-8000-000000000001",
  options: {
    filename: "failed-analysis",
    ...PDF_EXPORT_DEFAULT_OPTIONS,
  },
} as const;

function mockFetch(status: number, body: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    })),
  );
}

beforeEach(() => {
  vi.mocked(triggerPdfExport).mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("exportPdfWithPrintFallback", () => {
  it("does not print-fallback for failed-analysis business-rule errors", async () => {
    mockFetch(400, {
      error: "분석 실패 답안은 PDF로 내보낼 수 없어요.",
      code: PDF_EXPORT_ERROR_CODES.failedAnalysisUnavailable,
    });
    vi.mocked(triggerPdfExport).mockResolvedValue({ exportId: "print-1" });

    let caught: unknown;
    try {
      await exportPdfWithPrintFallback(request);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(PdfExportApiError);
    expect(caught).toMatchObject({
      status: 400,
      code: PDF_EXPORT_ERROR_CODES.failedAnalysisUnavailable,
    });
    expect(triggerPdfExport).not.toHaveBeenCalled();
  });

  it("keeps browser-print fallback for server render failures", async () => {
    mockFetch(500, { error: "render failed" });
    vi.mocked(triggerPdfExport).mockResolvedValue({ exportId: "print-1" });

    await expect(exportPdfWithPrintFallback(request)).resolves.toEqual({
      mode: "print",
      exportId: "print-1",
      fallbackReason: "render failed",
    });
    expect(triggerPdfExport).toHaveBeenCalledWith({
      sourceType: "submission",
      sourceId: request.sourceId,
    });
  });
});
