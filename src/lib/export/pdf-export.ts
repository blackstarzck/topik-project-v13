"use client";

import { readPdfExportApiError } from "./pdf-export-api-error";
import type { PdfExportRequest } from "./pdf-options";

export type PdfExportSourceType = "submission" | "report" | "library_selection";
export type PdfExportInput = PdfExportRequest;

export type PdfExportResult = {
  exportId: string;
};

type Fetcher = typeof fetch;

export async function triggerPdfExport(
  input: PdfExportInput,
  fetcher: Fetcher = fetch,
): Promise<PdfExportResult> {
  const response = await fetcher("/api/export/pdf/print", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
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
