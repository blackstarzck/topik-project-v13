export const PDF_EXPORT_ERROR_CODES = {
  failedAnalysisUnavailable: "failed_analysis_export_unavailable",
  quotaExceeded: "pdf_export_quota_exceeded",
} as const;

export type PdfExportErrorCode =
  (typeof PDF_EXPORT_ERROR_CODES)[keyof typeof PDF_EXPORT_ERROR_CODES];
