import { renderToBuffer } from "@react-pdf/renderer";
import dayjs from "dayjs";
import { NextResponse, type NextRequest } from "next/server";

import { isEmailVerified } from "@/lib/auth/access-gate";
import { fetchProfileStatus, isActiveStatus } from "@/lib/auth/profile";
import { buildPdfDocument, registerPdfFonts } from "@/lib/export/pdf-document";
import { PDF_EXPORT_ERROR_CODES } from "@/lib/export/pdf-export-errors";
import {
  claimPdfExportQuota,
  commitPdfExportQuota,
  getPdfExportProblemIds,
  PdfExportRequestError,
  releasePdfExportQuota,
  resolvePdfExportItems,
  type PdfExportQuotaClaim,
} from "@/lib/export/pdf-export-server";
import {
  pdfExportRequestSchema,
  sanitizePdfFilename,
} from "@/lib/export/pdf-options";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { SupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "generated-exports";

function requestErrorBody(error: PdfExportRequestError) {
  return {
    error: error.message,
    code: error.code,
    ...error.details,
  };
}

async function markExportFailed(
  supabase: SupabaseServerClient,
  exportId: string | null,
  failureCode: PdfExportFailureCode,
): Promise<void> {
  if (!exportId) return;
  await supabase
    .from("export_files")
    .update({
      status: "failed",
      failure_code: failureCode,
      failed_at: new Date().toISOString(),
      ready_at: null,
    })
    .eq("id", exportId)
    .then(
      () => undefined,
      () => undefined,
    );
}

type PdfExportFailureCode =
  | "quota_exceeded"
  | "quota_claim_failed"
  | "analysis_unavailable"
  | "item_unavailable"
  | "item_resolution_failed"
  | "server_render_failed"
  | "storage_upload_failed"
  | "quota_commit_failed"
  | "export_record_failed"
  | "unknown";

function classifiedFailureCode(
  error: unknown,
  fallback: PdfExportFailureCode,
): PdfExportFailureCode {
  if (error instanceof PdfExportRequestError) {
    if (error.code === PDF_EXPORT_ERROR_CODES.quotaExceeded) {
      return "quota_exceeded";
    }
    if (error.code === PDF_EXPORT_ERROR_CODES.failedAnalysisUnavailable) {
      return "analysis_unavailable";
    }
    return "item_unavailable";
  }
  return fallback;
}

async function releaseQuotaQuietly(
  supabase: SupabaseServerClient,
  userId: string,
  quotaClaim: PdfExportQuotaClaim | null,
  reason: string,
): Promise<void> {
  if (!quotaClaim) return;
  await releasePdfExportQuota(
    supabase,
    userId,
    quotaClaim.usageIds,
    reason,
  ).catch(() => undefined);
}

export async function POST(request: NextRequest) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const parsed = pdfExportRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "내보내기 옵션이 올바르지 않아요." },
      { status: 400 },
    );
  }
  const exportRequest = parsed.data;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  if (!isEmailVerified(user)) {
    return NextResponse.json({ error: "email_unverified" }, { status: 403 });
  }
  if (!isActiveStatus(await fetchProfileStatus(supabase, user.id))) {
    return NextResponse.json({ error: "account_inactive" }, { status: 403 });
  }

  let quotaClaim: PdfExportQuotaClaim | null = null;
  let exportId: string | null = null;
  let quotaSupabase: SupabaseServerClient | null = null;
  let failureCode: PdfExportFailureCode = "unknown";

  try {
    failureCode = "export_record_failed";
    const { data: created, error: insertError } = await supabase
      .from("export_files")
      .insert({
        user_id: user.id,
        source_type: exportRequest.sourceType,
        source_id:
          exportRequest.sourceType === "library_selection"
            ? null
            : exportRequest.sourceId,
        storage_path: `server-render://${crypto.randomUUID()}`,
        options: { source: "server_render", ...exportRequest.options },
        status: "queued",
      })
      .select("id")
      .single();
    if (insertError || !created) {
      throw new Error(
        insertError?.message ?? "failed to insert export_files row",
      );
    }
    exportId = created.id as string;

    failureCode = "item_resolution_failed";
    const items = await resolvePdfExportItems(supabase, exportRequest);
    quotaSupabase =
      createSupabaseServiceRoleClient() as unknown as SupabaseServerClient;
    failureCode = "quota_claim_failed";
    quotaClaim = await claimPdfExportQuota(
      supabase,
      user.id,
      getPdfExportProblemIds(items),
    );

    failureCode = "server_render_failed";
    registerPdfFonts();
    const buffer = await renderToBuffer(
      buildPdfDocument({
        title: sanitizePdfFilename(exportRequest.options.filename),
        generatedAtLabel: dayjs().format("YYYY-MM-DD"),
        items,
        options: exportRequest.options,
      }),
    );

    failureCode = "storage_upload_failed";
    const storagePath = `exports/${user.id}/${exportId}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: "application/pdf",
        upsert: false,
      });
    if (uploadError) {
      throw new Error(`storage upload: ${uploadError.message}`);
    }

    failureCode = "export_record_failed";
    const { error: updateError } = await supabase
      .from("export_files")
      .update({
        storage_path: storagePath,
        status: "ready",
        ready_at: new Date().toISOString(),
        failure_code: null,
        failed_at: null,
      })
      .eq("id", exportId);
    if (updateError) {
      await supabase.storage
        .from(BUCKET)
        .remove([storagePath])
        .then(
          () => undefined,
          () => undefined,
        );
      throw new Error(`export_files update: ${updateError.message}`);
    }

    failureCode = "quota_commit_failed";
    await commitPdfExportQuota(
      quotaSupabase,
      user.id,
      quotaClaim.usageIds,
      exportId,
    );
    quotaClaim = null;

    await supabase
      .from("study_events")
      .insert({
        user_id: user.id,
        event_type: "export_downloaded",
        submission_id:
          exportRequest.sourceType === "submission"
            ? exportRequest.sourceId
            : null,
        payload: {
          source_type: exportRequest.sourceType,
          source_id:
            exportRequest.sourceType === "library_selection"
              ? null
              : exportRequest.sourceId,
          export_id: exportId,
          source: "server_render",
        },
      })
      .then(
        () => undefined,
        () => undefined,
      );

    return NextResponse.json({
      exportId,
      storagePath,
      filename: `${sanitizePdfFilename(exportRequest.options.filename)}.pdf`,
    });
  } catch (err) {
    const outcomeCode = classifiedFailureCode(err, failureCode);
    await markExportFailed(supabase, exportId, outcomeCode);
    if (quotaSupabase) {
      await releaseQuotaQuietly(
        quotaSupabase,
        user.id,
        quotaClaim,
        "server_render_failed",
      );
    }

    if (err instanceof PdfExportRequestError) {
      return NextResponse.json(requestErrorBody(err), { status: err.status });
    }
    console.error("[api/export/pdf] generation failed", {
      exportId,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "PDF 생성에 실패했어요. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method Not Allowed", allow: ["POST"] },
    { status: 405, headers: { Allow: "POST" } },
  );
}
