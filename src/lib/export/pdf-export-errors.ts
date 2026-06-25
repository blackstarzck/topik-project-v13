export const PDF_EXPORT_ERROR_CODES = {
  failedAnalysisUnavailable: "failed_analysis_export_unavailable",
} as const;

export type PdfExportErrorCode =
  (typeof PDF_EXPORT_ERROR_CODES)[keyof typeof PDF_EXPORT_ERROR_CODES];
