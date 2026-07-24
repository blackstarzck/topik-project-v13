// F-M1 서버 PDF — 요청을 PDF 항목 데이터로 변환하는 서버 전용 조립기.
// 모든 조회는 사용자 세션 클라이언트로 실행되어 RLS(본인 소유)가 강제된다.
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

import type { SupabaseServerClient } from "../supabase/server";
import { normalizeWritingProblem } from "../writing/problem-normalizer";
import { getFeedbackBundle, getSubmission } from "../writing/server";
import { PDF_EXPORT_ERROR_CODES } from "./pdf-export-errors";
import type {
  PdfExportItem,
  PdfProblemContext,
  PdfSubmissionItem,
} from "./pdf-document";
import { PDF_EXPORT_MAX_ITEMS, type PdfExportRequest } from "./pdf-options";

dayjs.extend(utc);
dayjs.extend(timezone);

export const PDF_EXPORT_QUOTA_DEFAULT_LIMIT = 3;

export type PdfExportQuotaPeriodUnit = "day" | "week" | "month";

export type PdfExportQuotaDetails = {
  limit: number;
  used: number;
  remaining: number;
  resetAt: string;
  periodUnit: PdfExportQuotaPeriodUnit;
  problemId?: string;
};

export type PdfExportQuotaClaim = PdfExportQuotaDetails & {
  usageIds: string[];
};

type PdfExportQuotaRpcResult = {
  allowed?: boolean;
  code?: string;
  usageIds?: string[];
  usage_ids?: string[];
  limit?: number;
  used?: number;
  remaining?: number;
  resetAt?: string;
  reset_at?: string;
  periodUnit?: string;
  period_unit?: string;
  problemId?: string;
  problem_id?: string;
};

type LibrarySelectionExportEntry = {
  kind: "submission" | "report";
  id: string;
  savedAt: string;
};

/** 사용자에게 그대로 보여줄 수 있는 안전한 메시지를 가진 요청 오류. */
export class PdfExportRequestError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: PdfExportQuotaDetails;
  constructor(
    status: number,
    message: string,
    code?: string,
    details?: PdfExportQuotaDetails,
  ) {
    super(message);
    this.name = "PdfExportRequestError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function formatZoned(value: dayjs.Dayjs): string {
  return value.format("YYYY-MM-DDTHH:mm:ssZ");
}

export function getPdfExportQuotaWindow(
  periodUnit: PdfExportQuotaPeriodUnit,
  periodTimezone: string,
  now = new Date(),
): { start: string; end: string } {
  const localNow = dayjs(now).tz(periodTimezone);
  let start: dayjs.Dayjs;

  if (periodUnit === "day") {
    start = localNow.startOf("day");
  } else if (periodUnit === "week") {
    const daysSinceMonday = (localNow.day() + 6) % 7;
    start = localNow.startOf("day").subtract(daysSinceMonday, "day");
  } else {
    start = localNow.startOf("month");
  }

  const end = start.add(1, periodUnit);
  return {
    start: formatZoned(start),
    end: formatZoned(end),
  };
}

export function getPdfExportProblemIds(items: PdfExportItem[]): string[] {
  return Array.from(
    new Set(items.map((item) => item.problemId).filter(Boolean)),
  );
}

function readQuotaDetails(
  data: PdfExportQuotaRpcResult,
): PdfExportQuotaDetails {
  return {
    limit: Number(data.limit ?? PDF_EXPORT_QUOTA_DEFAULT_LIMIT),
    used: Number(data.used ?? 0),
    remaining: Number(data.remaining ?? 0),
    resetAt: String(data.resetAt ?? data.reset_at ?? ""),
    periodUnit: String(
      data.periodUnit ?? data.period_unit ?? "month",
    ) as PdfExportQuotaPeriodUnit,
    problemId: data.problemId ?? data.problem_id,
  };
}

export async function claimPdfExportQuota(
  supabase: SupabaseServerClient,
  userId: string,
  problemIds: string[],
): Promise<PdfExportQuotaClaim> {
  const distinctProblemIds = Array.from(new Set(problemIds.filter(Boolean)));
  if (distinctProblemIds.length === 0) {
    throw new PdfExportRequestError(
      400,
      "PDF 내보내기 대상 문제를 확인할 수 없어요.",
    );
  }

  const { data, error } = await supabase.rpc("claim_pdf_export_quota", {
    p_user_id: userId,
    p_problem_ids: distinctProblemIds,
  });
  if (error) throw new Error(`pdf export quota claim: ${error.message}`);
  if (!data || typeof data !== "object") {
    throw new Error("pdf export quota claim: empty response");
  }

  const result = data as PdfExportQuotaRpcResult;
  const details = readQuotaDetails(result);
  if (result.allowed === false) {
    throw new PdfExportRequestError(
      429,
      "PDF 내보내기 횟수를 모두 사용했어요.",
      result.code ?? PDF_EXPORT_ERROR_CODES.quotaExceeded,
      details,
    );
  }

  const usageIds = result.usageIds ?? result.usage_ids ?? [];
  if (result.allowed !== true || usageIds.length === 0) {
    throw new Error("pdf export quota claim: invalid response");
  }

  return {
    usageIds,
    ...details,
  };
}

export async function commitPdfExportQuota(
  supabase: SupabaseServerClient,
  userId: string,
  usageIds: string[],
  exportFileId: string,
): Promise<void> {
  if (usageIds.length === 0) return;
  const { error } = await supabase.rpc("commit_pdf_export_quota", {
    p_user_id: userId,
    p_usage_ids: usageIds,
    p_export_file_id: exportFileId,
  });
  if (error) throw new Error(`pdf export quota commit: ${error.message}`);
}

export async function releasePdfExportQuota(
  supabase: SupabaseServerClient,
  userId: string,
  usageIds: string[],
  reason?: string,
): Promise<void> {
  if (usageIds.length === 0) return;
  const { error } = await supabase.rpc("release_pdf_export_quota", {
    p_user_id: userId,
    p_usage_ids: usageIds,
    p_reason: reason ?? null,
  });
  if (error) throw new Error(`pdf export quota release: ${error.message}`);
}

function formatDate(value: string): string {
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("YYYY-MM-DD") : value;
}

function snapshotRecord(snapshot: unknown): Record<string, unknown> | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return null;
  }
  return snapshot as Record<string, unknown>;
}

function snapshotString(
  snapshot: Record<string, unknown>,
  key: string,
): string {
  const value = snapshot[key];
  return typeof value === "string" ? value : "";
}

function projectProblemContext(
  snapshot: unknown,
  problemId: string,
  questionNo: number,
): PdfProblemContext {
  const source = snapshotRecord(snapshot);
  if (!source || ![51, 52, 53, 54].includes(questionNo)) {
    return { kind: "unavailable", questionNo };
  }

  const normalized = normalizeWritingProblem({
    id: problemId,
    canonicalQuestionId: snapshotString(source, "question_id") || null,
    canonicalImportId: snapshotString(source, "canonical_import_id") || null,
    payloadHash: snapshotString(source, "payload_hash") || null,
    title: snapshotString(source, "title"),
    prompt: snapshotString(source, "prompt"),
    questionNo: questionNo as 51 | 52 | 53 | 54,
    materials: source.materials ?? {},
    tags: Array.isArray(source.tags)
      ? source.tags.filter((tag): tag is string => typeof tag === "string")
      : [],
    lifecycleStatus: "active",
  });

  if (normalized.kind === "q51" || normalized.kind === "q52") {
    return {
      kind: normalized.kind,
      title: normalized.title,
      prompt: normalized.prompt,
      blankedPrompt: normalized.blankedPrompt,
      blanks: normalized.blanks.map((blank) => ({
        label: blank.label,
        role: blank.role,
        functionLabel: blank.functionLabel,
        answerType: blank.answerType,
      })),
    };
  }

  if (normalized.kind === "q53") {
    return {
      kind: "q53",
      title: normalized.title,
      prompt: normalized.prompt,
      writingTasks: normalized.writingTasks,
      materialCards: normalized.materialCards.map((card) =>
        card.kind === "chart"
          ? {
              id: card.id,
              kind: "chart" as const,
              title: card.title,
              subtitle: card.subtitle,
              chart: {
                title: card.chart.title,
                unit: card.chart.unit,
                yearRange: card.chart.yearRange,
                series: card.chart.series,
              },
            }
          : {
              id: card.id,
              kind: "reference" as const,
              title: card.title,
              subtitle: card.subtitle,
              rows: card.rows,
            },
      ),
    };
  }

  return {
    kind: "q54",
    title: normalized.title,
    prompt: normalized.prompt,
    topicTitle: normalized.topicTitle,
    topicDefinition: normalized.topicDefinition,
    background: normalized.background,
    requiredQuestions: normalized.requiredQuestions,
  };
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
  if (submission.feedback_status === "failed") {
    throw new PdfExportRequestError(
      400,
      "분석 실패 답안은 PDF로 내보낼 수 없어요.",
      PDF_EXPORT_ERROR_CODES.failedAnalysisUnavailable,
    );
  }

  const pinnedSnapshot =
    submission.question_snapshot ?? submission.legacy_cutover_snapshot;
  const problemContext = projectProblemContext(
    pinnedSnapshot,
    submission.problem_id,
    submission.question_no,
  );

  const bundle = includeFeedback
    ? await getFeedbackBundle(submissionId, factory)
    : null;

  return {
    kind: "submission",
    problemId: submission.problem_id,
    questionNo: submission.question_no,
    problemContext,
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

async function loadReportItem(
  supabase: SupabaseServerClient,
  reportId: string,
): Promise<PdfExportItem> {
  const { data: report, error } = await supabase
    .from("comparison_reports")
    .select("id, current_submission_id, narrative, generated_at")
    .eq("id", reportId)
    .maybeSingle();
  if (error) throw new Error(`resolvePdfExportItems: ${error.message}`);
  if (!report) {
    throw new PdfExportRequestError(404, "리포트를 찾을 수 없어요.");
  }
  const { data: submission, error: submissionError } = await supabase
    .from("writing_submissions")
    .select("problem_id")
    .eq("id", report.current_submission_id)
    .maybeSingle();
  if (submissionError) {
    throw new Error(
      `resolvePdfExportItems(report submission): ${submissionError.message}`,
    );
  }
  if (!submission?.problem_id) {
    throw new PdfExportRequestError(404, "리포트의 문제를 찾을 수 없어요.");
  }

  return {
    kind: "report",
    problemId: submission.problem_id,
    generatedAt: formatDate(report.generated_at),
    narrative: report.narrative,
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
    return [await loadReportItem(supabase, request.sourceId)];
  }

  // library_selection: 본인 library_items(submission 항목) → 제출별 PDF 블록.
  const { data: rows, error } = await supabase
    .from("library_items")
    .select("id, item_type, submission_id, report_id, saved_at")
    .in("id", request.itemIds);
  if (error) throw new Error(`resolvePdfExportItems: ${error.message}`);

  const selectedEntries: LibrarySelectionExportEntry[] = [];
  for (const row of rows ?? []) {
    if (row.item_type === "submission" && row.submission_id) {
      selectedEntries.push({
        kind: "submission",
        id: row.submission_id,
        savedAt: row.saved_at,
      });
      continue;
    }
    if (row.item_type === "report" && row.report_id) {
      selectedEntries.push({
        kind: "report",
        id: row.report_id,
        savedAt: row.saved_at,
      });
    }
  }

  if (selectedEntries.length === 0) {
    // RLS가 타인 항목을 걸렀거나(빈 결과) 답안 항목이 아닌 경우.
    throw new PdfExportRequestError(
      404,
      "내보낼 수 있는 저장 답안을 찾지 못했어요.",
    );
  }
  if (selectedEntries.length > PDF_EXPORT_MAX_ITEMS) {
    throw new PdfExportRequestError(
      400,
      `한 번에 ${PDF_EXPORT_MAX_ITEMS}개까지 내보낼 수 있어요.`,
    );
  }

  // 저장 시각 최신순 — 라이브러리 목록과 같은 순서로 PDF에 담는다.
  selectedEntries.sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));

  const items: PdfExportItem[] = [];
  for (const entry of selectedEntries) {
    if (entry.kind === "submission") {
      items.push(
        await loadSubmissionItem(
          supabase,
          entry.id,
          request.options.includeFeedback,
        ),
      );
    } else {
      items.push(await loadReportItem(supabase, entry.id));
    }
  }
  return items;
}
