// NOTE: server-only by convention. We do not `import "server-only"` because
// the package is not a runtime dep and vitest cannot resolve it.
import {
  createSupabaseServerClient,
  type SupabaseServerClient,
} from "../supabase/server";
import { getProblemAvailability } from "../problems/availability";
import type {
  ComparisonReportRow,
  FeedbackBundle,
  QuestionNo,
  WritingDraftRow,
  WritingFeedbackRow,
  WritingRetrySeed,
  WritingSubmissionRow,
} from "./types";
import { isQuestionNo } from "./types";
import type { NormalizedWritingProblem } from "./problem-normalizer";
import { writingProblemHref } from "./routes";
import { getCanonicalWritingProblems } from "./canonical-source";

type ClientFactory = () => Promise<SupabaseServerClient>;

export async function getActiveDraft(
  userId: string,
  problemId: string,
  createClient: ClientFactory = createSupabaseServerClient,
): Promise<WritingDraftRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("writing_drafts")
    .select("*")
    .eq("user_id", userId)
    .eq("problem_id", problemId)
    .neq("autosave_status", "superseded")
    .maybeSingle();
  if (error) throw new Error(`getActiveDraft: ${error.message}`);
  return data;
}

export async function getSubmission(
  submissionId: string,
  createClient: ClientFactory = createSupabaseServerClient,
): Promise<WritingSubmissionRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("writing_submissions")
    .select("*")
    .eq("id", submissionId)
    .maybeSingle();
  if (error) throw new Error(`getSubmission: ${error.message}`);
  return data;
}

export async function getRetrySubmissionSeed({
  userId,
  submissionId,
  problemId,
  questionNo,
  createClient = createSupabaseServerClient,
}: {
  userId: string;
  submissionId: string | null | undefined;
  problemId: string | null | undefined;
  questionNo: QuestionNo;
  createClient?: ClientFactory;
}): Promise<WritingRetrySeed | null> {
  if (!isProblemIdLikeUuid(problemId) || !isProblemIdLikeUuid(submissionId)) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("writing_submissions")
    .select("id, answer_text, answer_json")
    .eq("id", submissionId)
    .eq("user_id", userId)
    .eq("problem_id", problemId)
    .eq("question_no", questionNo)
    .maybeSingle();
  if (error) throw new Error(`getRetrySubmissionSeed: ${error.message}`);
  if (!data) return null;

  return {
    parent_submission_id: data.id,
    answer_text: data.answer_text,
    answer_json: data.answer_json,
  };
}

export async function getFeedbackBundle(
  submissionId: string,
  createClient: ClientFactory = createSupabaseServerClient,
): Promise<FeedbackBundle | null> {
  const supabase = await createClient();
  const [fb, dims, sents] = await Promise.all([
    supabase
      .from("writing_feedback")
      .select("*")
      .eq("submission_id", submissionId)
      .maybeSingle(),
    supabase
      .from("feedback_dimension_scores")
      .select("*")
      .eq("submission_id", submissionId),
    supabase
      .from("sentence_feedback")
      .select("*")
      .eq("submission_id", submissionId)
      .order("sentence_index", { ascending: true }),
  ]);
  if (fb.error) throw new Error(`getFeedback: ${fb.error.message}`);
  if (dims.error) throw new Error(`getDimensions: ${dims.error.message}`);
  if (sents.error) throw new Error(`getSentences: ${sents.error.message}`);
  if (!fb.data) return null;
  return {
    feedback: fb.data,
    dimensions: dims.data ?? [],
    sentences: sents.data ?? [],
  };
}

export async function getComparisonReport(
  reportId: string,
  createClient: ClientFactory = createSupabaseServerClient,
): Promise<ComparisonReportRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comparison_reports")
    .select("*")
    .eq("id", reportId)
    .maybeSingle();
  if (error) throw new Error(`getComparisonReport: ${error.message}`);
  return data;
}

export type ComparisonTargetCandidate = {
  submissionId: string;
  questionNo: number;
  problemId: string;
  submittedAt: string;
  feedbackStatus: WritingSubmissionRow["feedback_status"];
  score: number | null;
  scoreMax: number | null;
  charCount: number;
  isSelected: boolean;
  isRecommended: boolean;
  isDisabled: boolean;
};

type FeedbackScoreRow = Pick<
  WritingFeedbackRow,
  "submission_id" | "score_total" | "score_max" | "status"
>;

export async function getComparisonTargetCandidates(
  currentSubmissionId: string,
  selectedPreviousSubmissionId: string | null | undefined,
  createClient: ClientFactory = createSupabaseServerClient,
): Promise<ComparisonTargetCandidate[]> {
  const supabase = await createClient();
  const { data: current, error: currentError } = await supabase
    .from("writing_submissions")
    .select("*")
    .eq("id", currentSubmissionId)
    .maybeSingle();
  if (currentError) {
    throw new Error(`getComparisonTargetCandidates: ${currentError.message}`);
  }
  if (!current) return [];

  const currentSub = current as WritingSubmissionRow;
  const { data: submissions, error: submissionsError } = await supabase
    .from("writing_submissions")
    .select(
      "id, user_id, problem_id, question_no, char_count, submitted_at, feedback_status, parent_submission_id",
    )
    .eq("user_id", currentSub.user_id)
    .eq("problem_id", currentSub.problem_id)
    .neq("id", currentSub.id)
    .lt("submitted_at", currentSub.submitted_at)
    .order("submitted_at", { ascending: false })
    .limit(30);
  if (submissionsError) {
    throw new Error(
      `getComparisonTargetCandidates: ${submissionsError.message}`,
    );
  }

  const rows = (submissions ?? []) as WritingSubmissionRow[];
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const { data: feedbackRows, error: feedbackError } = await supabase
    .from("writing_feedback")
    .select("submission_id, score_total, score_max, status")
    .in("submission_id", ids);
  if (feedbackError) {
    throw new Error(`getComparisonTargetCandidates: ${feedbackError.message}`);
  }

  const feedbackBySubmission = new Map(
    ((feedbackRows ?? []) as FeedbackScoreRow[]).map((row) => [
      row.submission_id,
      row,
    ]),
  );
  const latestComplete = rows.find((row) => row.feedback_status === "complete");
  const recommendedId = rows.some(
    (row) => row.id === currentSub.parent_submission_id,
  )
    ? currentSub.parent_submission_id
    : (latestComplete?.id ?? null);

  return rows.map((row) => {
    const feedback = feedbackBySubmission.get(row.id);
    const enabled =
      row.feedback_status === "complete" && feedback?.status === "complete";
    return {
      submissionId: row.id,
      questionNo: row.question_no,
      problemId: row.problem_id,
      submittedAt: row.submitted_at,
      feedbackStatus: row.feedback_status,
      score: feedback?.score_total ?? null,
      scoreMax: feedback?.score_max ?? null,
      charCount: row.char_count,
      isSelected: row.id === selectedPreviousSubmissionId,
      isRecommended: row.id === recommendedId,
      isDisabled: !enabled,
    };
  });
}

export type WritingProblem = NormalizedWritingProblem;

type WritingProblemHistoryRow = {
  problem_id: string | null;
};

type WritingProblemHistoryQueryResult = {
  data: WritingProblemHistoryRow[] | null;
  error: { message: string } | null;
};

type GetWritingProblemOptions = {
  userId?: string | null;
};

// problems.id는 uuid 컬럼 — 형식이 아닌 값을 .eq("id", …)에 넘기면 PostgREST가
// uuid 캐스트 오류(22P02)로 500을 돌려줘 서버 에러 바운더리에 도달한다 (D-3,
// QA 2026-06-12). 형식 검증으로 "존재하지 않는 문제"와 같은 null 경로로 보낸다.
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isProblemIdLikeUuid(
  problemId: string | null | undefined,
): problemId is string {
  return typeof problemId === "string" && UUID_PATTERN.test(problemId);
}

export async function getNextWritingProblemStartHref({
  currentProblemId,
  questionNo,
  createClient = createSupabaseServerClient,
}: {
  currentProblemId: string | null | undefined;
  questionNo: number | null | undefined;
  createClient?: ClientFactory;
}): Promise<string> {
  const target = await getNextWritingProblemTarget({
    currentProblemId,
    questionNo,
    createClient,
  });

  return writingProblemHref({
    questionNo: target?.questionNo ?? questionNo,
    problemId: target?.problemId ?? null,
    fresh: true,
  });
}

async function getNextWritingProblemTarget({
  currentProblemId,
  questionNo,
  createClient,
}: {
  currentProblemId: string | null | undefined;
  questionNo: number | null | undefined;
  createClient: ClientFactory;
}): Promise<{ problemId: string; questionNo: QuestionNo } | null> {
  const supabase = await createClient();
  if (!isQuestionNo(questionNo) || !isProblemIdLikeUuid(currentProblemId)) {
    return null;
  }

  const canonicalProblems = await getCanonicalWritingProblems({
    supabase,
    questionNo,
  });
  const currentIndex = canonicalProblems.findIndex(
    (problem) => problem.id === currentProblemId,
  );
  const target =
    canonicalProblems[currentIndex + 1] ?? canonicalProblems[0] ?? null;

  return target
    ? { problemId: target.id, questionNo: target.questionNo }
    : null;
}

async function getTouchedWritingProblemIds(
  supabase: SupabaseServerClient,
  userId: string,
  problemIds: readonly string[],
): Promise<Set<string>> {
  const uniqueIds = [...new Set(problemIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Set();

  const [submissions, drafts] = (await Promise.all([
    supabase
      .from("writing_submissions")
      .select("problem_id")
      .eq("user_id", userId)
      .in("problem_id", uniqueIds),
    supabase
      .from("writing_drafts")
      .select("problem_id")
      .eq("user_id", userId)
      .in("problem_id", uniqueIds),
  ])) as unknown as [
    WritingProblemHistoryQueryResult,
    WritingProblemHistoryQueryResult,
  ];

  if (submissions.error) {
    throw new Error(
      `getWritingProblem(writing_submissions): ${submissions.error.message}`,
    );
  }
  if (drafts.error) {
    throw new Error(
      `getWritingProblem(writing_drafts): ${drafts.error.message}`,
    );
  }

  return new Set(
    [...(submissions.data ?? []), ...(drafts.data ?? [])].flatMap((row) =>
      row.problem_id ? [row.problem_id] : [],
    ),
  );
}

export async function getWritingProblem(
  questionNo: number,
  problemId: string | undefined,
  createClient: ClientFactory = createSupabaseServerClient,
  options: GetWritingProblemOptions = {},
): Promise<WritingProblem | null> {
  const supabase = await createClient();
  if (!isQuestionNo(questionNo)) return null;
  if (problemId && !isProblemIdLikeUuid(problemId)) return null;

  const canonicalProblems = await getCanonicalWritingProblems({
    supabase,
    questionNo,
    problemId: problemId ?? null,
  });

  if (problemId) return canonicalProblems[0] ?? null;
  if (options.userId) {
    const submittable = canonicalProblems.filter(
      (problem) => problem.submitBlockedReason === null,
    );
    const touchedIds = await getTouchedWritingProblemIds(
      supabase,
      options.userId,
      submittable.map((problem) => problem.id),
    );
    return submittable.find((problem) => !touchedIds.has(problem.id)) ?? null;
  }
  return (
    canonicalProblems.find((problem) => problem.submitBlockedReason === null) ??
    canonicalProblems[0] ??
    null
  );
}

export async function getWritingProblemAvailability(
  problemId: string | null | undefined,
  createClient: ClientFactory = createSupabaseServerClient,
) {
  const supabase = await createClient();
  if (!isProblemIdLikeUuid(problemId)) return getProblemAvailability(null);

  const canonicalProblems = await getCanonicalWritingProblems({
    supabase,
    problemId,
  });
  return getProblemAvailability(
    canonicalProblems.length > 0
      ? {
          publishStatus: "published",
          visibility: "public",
          lifecycleStatus: "active",
          lifecycleReason: null,
        }
      : null,
  );

}
