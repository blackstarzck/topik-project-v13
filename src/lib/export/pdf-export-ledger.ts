import type { Json } from "../supabase/types";
import type { SupabaseServerClient } from "../supabase/server";
import { PdfExportRequestError } from "./pdf-export-server";
import type { PdfExportRequest } from "./pdf-options";

export type PdfExportRenderSource = "server_render" | "browser_print";

export type PreparedPdfExportLedger = {
  attemptId: string | null;
  exportId: string;
  leaseExpiresAt: string | null;
  state: "queued" | "ready";
  storagePath: string;
  renderSource: PdfExportRenderSource;
};

type AcquisitionRpcError = {
  code?: string;
  message?: string;
};

function requestItemIds(request: PdfExportRequest): string[] | null {
  return request.sourceType === "library_selection"
    ? [...request.itemIds].sort()
    : null;
}

function requestOptions(request: PdfExportRequest): Json {
  return {
    ...request.options,
    request_item_ids: requestItemIds(request),
  };
}

function acquisitionError(error: AcquisitionRpcError): Error {
  if (error.code === "55P03") {
    return new PdfExportRequestError(
      409,
      "PDF 내보내기가 이미 진행 중이에요. 잠시 후 다시 확인해 주세요.",
    );
  }
  if (error.code === "22023") {
    return new PdfExportRequestError(
      409,
      "같은 PDF 요청 번호를 다른 내보내기에 다시 사용할 수 없어요.",
    );
  }
  if (error.code === "42501") {
    return new PdfExportRequestError(
      403,
      "PDF 내보내기 대상에 접근할 수 없어요.",
    );
  }
  if (error.code === "P0002") {
    return new PdfExportRequestError(
      404,
      "PDF 내보내기 대상을 찾을 수 없어요.",
    );
  }
  return new Error(
    `PDF export attempt acquisition: ${error.message ?? "unknown error"}`,
  );
}

function parseAcquisition(data: Json | null): PreparedPdfExportLedger {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("PDF export attempt acquisition: invalid response");
  }

  const state = data.state;
  const attemptId = data.attemptId;
  const exportId = data.exportId;
  const leaseExpiresAt = data.leaseExpiresAt;
  const renderSource = data.renderSource;
  const storagePath = data.storagePath;
  if (
    (state !== "queued" && state !== "ready") ||
    typeof exportId !== "string" ||
    typeof storagePath !== "string" ||
    (renderSource !== "server_render" && renderSource !== "browser_print") ||
    (leaseExpiresAt !== null && typeof leaseExpiresAt !== "string") ||
    (state === "queued" && typeof attemptId !== "string") ||
    (state === "ready" && attemptId !== null)
  ) {
    throw new Error("PDF export attempt acquisition: invalid response");
  }

  return {
    attemptId: attemptId as string | null,
    exportId,
    leaseExpiresAt,
    renderSource,
    state,
    storagePath,
  };
}

export async function preparePdfExportLedger(
  supabase: SupabaseServerClient,
  _userId: string,
  request: PdfExportRequest,
  renderSource: PdfExportRenderSource,
): Promise<PreparedPdfExportLedger> {
  const { data, error } = await supabase.rpc("acquire_pdf_export_attempt", {
    p_request_id: request.requestId,
    p_source_type: request.sourceType,
    p_source_id:
      request.sourceType === "library_selection" ? null : request.sourceId,
    p_request_options: requestOptions(request),
    p_render_source: renderSource,
  });
  if (error) throw acquisitionError(error);
  return parseAcquisition(data);
}
