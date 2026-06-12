// F-M1 서버 PDF — 요청을 PDF 항목 데이터로 변환하는 서버 전용 조립기.
// 모든 조회는 사용자 세션 클라이언트로 실행되어 RLS(본인 소유)가 강제된다.
import dayjs from "dayjs";

import type { SupabaseServerClient } from "../supabase/server";
import { getFeedbackBundle, getSubmission } from "../writing/server";
import type { PdfExportItem, PdfSubmissionItem } from "./pdf-document";
import { PDF_EXPORT_MAX_ITEMS, type PdfExportRequest } from "./pdf-options";

/** 사용자에게 그대로 보여줄 수 있는 안전한 메시지를 가진 요청 오류. */
export class PdfExportRequestError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "PdfExportRequestError";
    this.status = status;
  }
}

function formatDate(value: string): string {
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("YYYY-MM-DD") : value;
}

async function loadSubmissionItem(
  supabase: SupabaseServerClient,
  submissionId: string,
  includeFeedback: boolean,
): Promise<PdfSubmissionItem> {
  const factory = async () => supabase;
  const submission = await getSubmission(submissionId, factory);
  if (!submission) {
    throw new PdfExportRequestError(404, "답안을 찾을 수 없어요.");
  }

  // 문제 제목 — problems는 published만 읽힌다(공개 RLS). 이후 회수된 문제면
  // null이 될 수 있으므로 제목 없이도 PDF는 만들어진다.
  const { data: problem } = await supabase
    .from("problems")
    .select("title")
    .eq("id", submission.problem_id)
    .maybeSingle();

  const bundle = includeFeedback
    ? await getFeedbackBundle(submissionId, factory)
    : null;

  return {
    kind: "submission",
    questionNo: submission.question_no,
    problemTitle: (problem as { title: string } | null)?.title ?? null,
    submittedAt: formatDate(submission.submitted_at),
    answerText: submission.answer_text,
    charCount: submission.char_count,
    feedback: bundle
      ? {
          scoreTotal: bundle.feedback.score_total,
          scoreMax: bundle.feedback.score_max,
          overallSummary: bundle.feedback.overall_summary,
          dimensions: bundle.dimensions.map((d) => ({
            dimension: d.dimension,
            score: d.score,
            scoreMax: d.score_max,
            summary: d.summary,
          })),
          sentences: bundle.sentences.map((s) => ({
            sentenceIndex: s.sentence_index,
            originalText: s.original_text,
            correctedText: s.corrected_text,
            comment: s.comment,
          })),
        }
      : null,
  };
}

export async function resolvePdfExportItems(
  supabase: SupabaseServerClient,
  request: PdfExportRequest,
): Promise<PdfExportItem[]> {
  if (request.sourceType === "submission") {
    return [
      await loadSubmissionItem(
        supabase,
        request.sourceId,
        request.options.includeFeedback,
      ),
    ];
  }

  if (request.sourceType === "report") {
    const { data: report, error } = await supabase
      .from("comparison_reports")
      .select("id, narrative, generated_at")
      .eq("id", request.sourceId)
      .maybeSingle();
    if (error) throw new Error(`resolvePdfExportItems: ${error.message}`);
    if (!report) {
      throw new PdfExportRequestError(404, "리포트를 찾을 수 없어요.");
    }
    return [
      {
        kind: "report",
        generatedAt: formatDate(report.generated_at),
        narrative: report.narrative,
      },
    ];
  }

  // library_selection: 본인 library_items(submission 항목) → 제출별 PDF 블록.
  const { data: rows, error } = await supabase
    .from("library_items")
    .select("id, item_type, submission_id, saved_at")
    .in("id", request.itemIds);
  if (error) throw new Error(`resolvePdfExportItems: ${error.message}`);

  const submissionIds = (rows ?? [])
    .filter((row) => row.item_type === "submission" && row.submission_id)
    .map((row) => ({ id: row.submission_id as string, savedAt: row.saved_at }));

  if (submissionIds.length === 0) {
    // RLS가 타인 항목을 걸렀거나(빈 결과) 답안 항목이 아닌 경우.
    throw new PdfExportRequestError(
      404,
      "내보낼 수 있는 저장 답안을 찾지 못했어요.",
    );
  }
  if (submissionIds.length > PDF_EXPORT_MAX_ITEMS) {
    throw new PdfExportRequestError(
      400,
      `한 번에 ${PDF_EXPORT_MAX_ITEMS}개까지 내보낼 수 있어요.`,
    );
  }

  // 저장 시각 최신순 — 라이브러리 목록과 같은 순서로 PDF에 담는다.
  submissionIds.sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));

  const items: PdfExportItem[] = [];
  for (const entry of submissionIds) {
    items.push(
      await loadSubmissionItem(
        supabase,
        entry.id,
        request.options.includeFeedback,
      ),
    );
  }
  return items;
}
