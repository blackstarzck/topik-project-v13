"use client";

// F-M1 서버 PDF — 클라이언트 진입점.
//
//   requestServerPdfExport(): POST /api/export/pdf → generated-exports에서
//     본인 파일을 내려받아 사용자 지정 파일명으로 저장한다.
//   exportPdfWithPrintFallback(): 서버 생성 실패 시 기존 브라우저 인쇄
//     (triggerPdfExport)로 폴백한다 (브리프 §3-B — 사용자를 빈손으로 두지
//     않는다). 폴백 발생 여부를 mode로 돌려줘 호출부가 안내를 띄운다.

import { createSupabaseBrowserClient } from "../supabase/browser";
import type { PdfExportErrorCode } from "./pdf-export-errors";
import { triggerPdfExport } from "./pdf-export";
import { sanitizePdfFilename, type PdfExportRequest } from "./pdf-options";

const BUCKET = "generated-exports";

export type ServerPdfExportResult = {
  exportId: string;
  storagePath: string;
  filename: string;
};

type BrowserClientFactory = typeof createSupabaseBrowserClient;

type PdfExportApiErrorBody = {
  error?: string;
  code?: string;
};

export class PdfExportApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "PdfExportApiError";
    this.status = status;
    this.code = code;
  }
}

function shouldUsePrintFallback(error: unknown): boolean {
  if (error instanceof PdfExportApiError) {
    return error.status >= 500;
  }
  return true;
}

export function getPdfExportErrorMessage(
  error: unknown,
  fallbackMessage: string,
  messagesByCode?: Partial<Record<PdfExportErrorCode, string>>,
): string {
  if (error instanceof PdfExportApiError) {
    const localized = error.code
      ? messagesByCode?.[error.code as PdfExportErrorCode]
      : undefined;
    return localized ?? fallbackMessage;
  }
  return error instanceof Error ? error.message : fallbackMessage;
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // revoke는 클릭 처리 이후로 미룬다 — 일부 브라우저는 즉시 revoke 시
  // 다운로드가 시작되지 않는다.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function filenameFromStoragePath(storagePath: string): string {
  const lastSegment = storagePath.split("/").filter(Boolean).at(-1);
  return lastSegment && lastSegment.endsWith(".pdf")
    ? lastSegment
    : "talkpik-export.pdf";
}

export async function downloadStoredPdfExport(
  input: {
    storagePath: string;
    filename?: string | null;
  },
  createClient: BrowserClientFactory = createSupabaseBrowserClient,
): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(input.storagePath);
  if (error || !data) {
    throw new Error(error?.message ?? "download failed");
  }
  triggerBrowserDownload(
    data,
    input.filename ?? filenameFromStoragePath(input.storagePath),
  );
}

export async function requestServerPdfExport(
  input: PdfExportRequest,
  createClient: BrowserClientFactory = createSupabaseBrowserClient,
): Promise<ServerPdfExportResult> {
  const response = await fetch("/api/export/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const body = (await response
      .json()
      .catch(() => null)) as PdfExportApiErrorBody | null;
    throw new PdfExportApiError(
      response.status,
      body?.error ?? `PDF export failed (HTTP ${response.status})`,
      body?.code,
    );
  }

  const result = (await response.json()) as ServerPdfExportResult;

  await downloadStoredPdfExport(
    {
      storagePath: result.storagePath,
      filename:
        result.filename ?? `${sanitizePdfFilename(input.options.filename)}.pdf`,
    },
    createClient,
  );
  return result;
}

export type PdfExportMode = "file" | "print";

export type PdfExportOutcome = {
  mode: PdfExportMode;
  exportId: string;
  /** mode='print'일 때 서버 생성이 실패한 원인 (안내용). */
  fallbackReason?: string;
};

export async function exportPdfWithPrintFallback(
  input: PdfExportRequest,
): Promise<PdfExportOutcome> {
  try {
    const result = await requestServerPdfExport(input);
    return { mode: "file", exportId: result.exportId };
  } catch (err) {
    if (!shouldUsePrintFallback(err)) {
      throw err;
    }
    const reason = err instanceof Error ? err.message : String(err);
    const printed = await triggerPdfExport({
      sourceType: input.sourceType,
      sourceId:
        input.sourceType === "library_selection" ? null : input.sourceId,
    });
    return {
      mode: "print",
      exportId: printed.exportId,
      fallbackReason: reason,
    };
  }
}
