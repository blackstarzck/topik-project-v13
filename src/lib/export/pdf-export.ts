"use client";

import { readPdfExportApiError } from "./pdf-export-api-error";
import {
  withPdfExportRequestId,
  type PdfExportRequest,
  type PdfExportRequestInput,
} from "./pdf-options";

export type PdfExportSourceType = "submission" | "report" | "library_selection";
export type PdfExportInput = PdfExportRequestInput | PdfExportRequest;

export type PdfExportResult = {
  exportId: string;
};

type Fetcher = typeof fetch;

export async function triggerPdfExport(
  input: PdfExportInput,
  fetcher: Fetcher = fetch,
): Promise<PdfExportResult> {
  const request = withPdfExportRequestId(input);
  const response = await fetcher("/api/export/pdf/print", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw await readPdfExportApiError(response);
  }

  const result = (await response.json()) as PdfExportResult;
  if (typeof window !== "undefined" && typeof window.print === "function") {
    window.print();
  }

  return { exportId: result.exportId };
}
