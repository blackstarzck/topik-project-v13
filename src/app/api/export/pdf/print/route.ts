import { NextResponse, type NextRequest } from "next/server";

import { isEmailVerified } from "@/lib/auth/access-gate";
import { fetchProfileStatus, isActiveStatus } from "@/lib/auth/profile";
import {
  claimPdfExportQuota,
  commitPdfExportQuota,
  completePdfExportAttempt,
  failPdfExportAttempt,
  getPdfExportProblemIds,
  PdfExportRequestError,
  releasePdfExportQuota,
  resolvePdfExportItems,
  type PdfExportQuotaClaim,
} from "@/lib/export/pdf-export-server";
import { PDF_EXPORT_ERROR_CODES } from "@/lib/export/pdf-export-errors";
import { preparePdfExportLedger } from "@/lib/export/pdf-export-ledger";
import { pdfExportRequestSchema } from "@/lib/export/pdf-options";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role.server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requestErrorBody(error: PdfExportRequestError) {
  return {
    error: error.message,
    code: error.code,
    ...error.details,
  };
}

type PdfExportFailureCode =
  | "quota_exceeded"
  | "quota_claim_failed"
  | "analysis_unavailable"
  | "item_unavailable"
  | "item_resolution_failed"
  | "browser_print_prepare_failed"
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
  let attemptId: string | null = null;
  let quotaSupabase: SupabaseServerClient | null = null;
  let failureCode: PdfExportFailureCode = "unknown";
  let ledgerState: "queued" | "ready" | null = null;

  try {
    failureCode = "export_record_failed";
    const ledger = await preparePdfExportLedger(
      supabase,
      user.id,
      exportRequest,
      "browser_print",
    );
    exportId = ledger.exportId;
    attemptId = ledger.attemptId;
    ledgerState = ledger.state;

    failureCode = "item_resolution_failed";
    const items = await resolvePdfExportItems(supabase, exportRequest);
    failureCode = "quota_claim_failed";
    quotaClaim = await claimPdfExportQuota(
      supabase,
      user.id,
      getPdfExportProblemIds(items),
      exportRequest.requestId,
    );
    quotaSupabase =
      createSupabaseServiceRoleClient() as unknown as SupabaseServerClient;

    if (ledger.state === "ready") {
      failureCode = "quota_commit_failed";
      await commitPdfExportQuota(
        quotaSupabase,
        user.id,
        quotaClaim.usageIds,
        exportId,
      );
      quotaClaim = null;
      return NextResponse.json({ exportId });
    }
    if (!attemptId) {
      throw new Error("PDF export attempt id missing");
    }

    failureCode = "browser_print_prepare_failed";
    failureCode = "quota_commit_failed";
    const completed = await completePdfExportAttempt(
      quotaSupabase,
      user.id,
      quotaClaim.usageIds,
      exportId,
      attemptId,
      ledger.storagePath,
    );
    if (!completed) throw new Error("PDF export attempt lease lost");
    quotaClaim = null;

    await supabase
      .from("study_events")
      .insert({
        user_id: user.id,
        event_type: "export_downloaded",
        payload: {
          source_type: exportRequest.sourceType,
          source_id:
            exportRequest.sourceType === "library_selection"
              ? null
              : exportRequest.sourceId,
          export_id: exportId,
          source: "browser_print",
        },
      })
      .then(
        () => undefined,
        () => undefined,
      );

    return NextResponse.json({ exportId });
  } catch (err) {
    const outcomeCode = classifiedFailureCode(err, failureCode);
    if (ledgerState === "queued" && exportId && attemptId && !quotaSupabase) {
      try {
        quotaSupabase =
          createSupabaseServiceRoleClient() as unknown as SupabaseServerClient;
      } catch {
        quotaSupabase = null;
      }
    }
    if (ledgerState === "queued" && quotaSupabase && exportId && attemptId) {
      await failPdfExportAttempt(
        quotaSupabase,
        user.id,
        quotaClaim?.usageIds ?? [],
        exportId,
        attemptId,
        outcomeCode,
        "browser_print_failed",
      ).catch(() => null);
    }
    if (ledgerState === "ready" && quotaSupabase) {
      await releaseQuotaQuietly(
        quotaSupabase,
        user.id,
        quotaClaim,
        "browser_print_failed",
      );
    }

    if (err instanceof PdfExportRequestError) {
      return NextResponse.json(requestErrorBody(err), { status: err.status });
    }
    console.error("[api/export/pdf/print] failed", {
      exportId,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "PDF 출력 준비에 실패했어요. 잠시 후 다시 시도해 주세요." },
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
