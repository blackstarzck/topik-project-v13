// F-M1 서버 PDF 생성 라우트 (브리프 docs/pdf-export-real-file-brief-20260612.md).
//
// POST /api/export/pdf — 동기 생성(§3-C): 요청 한 번에
//   1. 사용자 세션 확인 (RLS는 같은 세션 클라이언트로 강제)
//   2. export_files row 생성(status='queued')
//   3. 대상 데이터 조회(본인 submission/report/library 선택) → react-pdf 렌더
//   4. generated-exports 버킷 exports/{user_id}/{export_id}.pdf 업로드
//      (스토리지 정책: 본인 경로 + PDF만 + 이메일 인증 강화)
//   5. status='ready' + ready_at 기록, study_events('export_downloaded')
// 실패 시 status='failed'로 남기고 5xx/4xx JSON을 돌려준다 — 클라이언트는
// 브라우저 인쇄 폴백(§3-B)으로 전환한다. 재시도는 항상 새 row(§3-H).
//
// runtime=nodejs 필수: react-pdf(yoga)와 폰트 파일(fs) 접근 때문에 Edge 불가.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import dayjs from "dayjs";

import { isEmailVerified } from "@/lib/auth/access-gate";
import { fetchProfileStatus, isActiveStatus } from "@/lib/auth/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildPdfDocument, registerPdfFonts } from "@/lib/export/pdf-document";
import {
  assertMonthlyPdfExportLimit,
  PdfExportRequestError,
  resolvePdfExportItems,
} from "@/lib/export/pdf-export-server";
import {
  pdfExportRequestSchema,
  sanitizePdfFilename,
} from "@/lib/export/pdf-options";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "generated-exports";

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
  // 회원 탈퇴(deleted)/차단(blocked) 계정 차단. /api/* 는 proxy 매처 제외라
  // 세션 기반 라우트가 직접 status 를 검증한다.
  if (!isEmailVerified(user)) {
    return NextResponse.json({ error: "email_unverified" }, { status: 403 });
  }
  if (!isActiveStatus(await fetchProfileStatus(supabase, user.id))) {
    return NextResponse.json({ error: "account_inactive" }, { status: 403 });
  }

  try {
    await assertMonthlyPdfExportLimit(supabase, user.id);
  } catch (err) {
    if (err instanceof PdfExportRequestError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { error: "PDF 내보내기 한도를 확인하지 못했어요." },
      { status: 500 },
    );
  }

  // §3-H: 재시도 포함 모든 시도가 새 row — 실패 이력이 ledger에 남는다.
  const { data: created, error: insertError } = await supabase
    .from("export_files")
    .insert({
      user_id: user.id,
      source_type: exportRequest.sourceType,
      source_id:
        exportRequest.sourceType === "library_selection"
          ? null
          : exportRequest.sourceId,
      // 업로드 후 실제 경로로 갱신된다. queued 단계의 placeholder.
      storage_path: `server-render://${crypto.randomUUID()}`,
      options: { source: "server_render", ...exportRequest.options },
      status: "queued",
    })
    .select("id")
    .single();
  if (insertError || !created) {
    return NextResponse.json(
      { error: "내보내기 기록을 만들지 못했어요." },
      { status: 500 },
    );
  }
  const exportId = created.id as string;

  async function markFailed() {
    await supabase
      .from("export_files")
      .update({ status: "failed" })
      .eq("id", exportId)
      .then(
        () => undefined,
        () => undefined,
      );
  }

  try {
    const items = await resolvePdfExportItems(supabase, exportRequest);

    registerPdfFonts();
    const buffer = await renderToBuffer(
      buildPdfDocument({
        title: sanitizePdfFilename(exportRequest.options.filename),
        generatedAtLabel: dayjs().format("YYYY-MM-DD"),
        items,
        options: exportRequest.options,
      }),
    );

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

    const { error: updateError } = await supabase
      .from("export_files")
      .update({
        storage_path: storagePath,
        status: "ready",
        ready_at: new Date().toISOString(),
      })
      .eq("id", exportId);
    if (updateError) {
      throw new Error(`export_files update: ${updateError.message}`);
    }

    // 텔레메트리 — 실패해도 내보내기 자체를 막지 않는다.
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
    await markFailed();
    if (err instanceof PdfExportRequestError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status },
      );
    }
    console.error("[api/export/pdf] generation failed", {
      exportId,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "PDF 생성에 실패했어요. 잠시 후 다시 시도해주세요." },
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
