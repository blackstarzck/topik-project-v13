export type PdfExportApiErrorBody = {
  error?: string;
  code?: string;
  limit?: number;
  used?: number;
  remaining?: number;
  resetAt?: string;
  periodUnit?: string;
};

export class PdfExportApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: Omit<PdfExportApiErrorBody, "error" | "code">;

  constructor(
    status: number,
    message: string,
    code?: string,
    details?: Omit<PdfExportApiErrorBody, "error" | "code">,
  ) {
    super(message);
    this.name = "PdfExportApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function readPdfExportApiError(
  response: Response,
): Promise<PdfExportApiError> {
  const body = (await response
    .json()
    .catch(() => null)) as PdfExportApiErrorBody | null;
  return new PdfExportApiError(
    response.status,
    body?.error ?? `PDF export failed (HTTP ${response.status})`,
    body?.code,
    body
      ? {
          limit: body.limit,
          used: body.used,
          remaining: body.remaining,
          resetAt: body.resetAt,
          periodUnit: body.periodUnit,
        }
      : undefined,
  );
}
