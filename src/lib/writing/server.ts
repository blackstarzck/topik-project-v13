// NOTE: server-only by convention. We do not `import "server-only"` because
// the package is not a runtime dep and vitest cannot resolve it.
import {
  createSupabaseServerClient,
  type SupabaseServerClient,
} from "../supabase/server";
import { getProblemAvailability } from "../problems/availability";
import {
  filterVisibleProblemIds,
  isWritingProblemVisibleToCaller,
} from "../problems/visibility";
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
import {
  normalizeWritingProblem,
  type NormalizedWritingProblem,
  type ProblemLifecycleStatus,
} from "./problem-normalizer";
import { writingProblemHref } from "./routes";

type ClientFactory = () => Promise<SupabaseServerClient>;

type ProblemAvailabilityQueryRow = {
  publish_status: string | null;
  visibility: string | null;
  lifecycle_status: string | null;
  lifecycle_reason: string | null;
  question_no: number | null;
};

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
const DEFAULT_PROBLEM_CANDIDATE_LIMIT = 25;
const PROBLEM_SCAN_PAGE_SIZE = 25;
const MAX_VISIBILITY_SCAN_ROWS = 200;

type WritingProblemQueryRow = {
  id: string;
  title: string;
  prompt: string;
  question_no: number | null;
  tags?: string[] | null;
  materials: unknown;
  answer_key: unknown;
  rubric: unknown;
  lifecycle_status?: ProblemLifecycleStatus | null;
  lifecycle_reason?: string | null;
};

type NextWritingProblemCandidateRow = Pick<
  WritingProblemQueryRow,
  "id" | "question_no" | "tags" | "materials"
>;

type WritingProblemQueryResult = {
  data: WritingProblemQueryRow[] | null;
  error: { message: string } | null;
};

type WritingProblemHistoryRow = {
  problem_id: string | null;
};

type WritingProblemHistoryQueryResult = {
  data: WritingProblemHistoryRow[] | null;
  error: { message: string } | null;
};

type NextWritingProblemCandidateResult = {
  data: NextWritingProblemCandidateRow[] | null;
  error: { message: string } | null;
};

type GetWritingProblemOptions = {
  userId?: string | null;
};

type RunWritingProblemQuery = (
  withLifecycle: boolean,
  range: { from: number; to: number } | null,
) => Promise<WritingProblemQueryResult>;

function normalizeWritingProblemRow(
  row: WritingProblemQueryRow,
  questionNo: QuestionNo,
): WritingProblem {
  return normalizeWritingProblem({
    id: row.id,
    title: row.title,
    prompt: row.prompt,
    questionNo,
    materials: row.materials,
    answerKey: row.answer_key,
    rubric: row.rubric,
    lifecycleStatus:
      "lifecycle_status" in row
        ? (row.lifecycle_status as ProblemLifecycleStatus)
        : "active",
    lifecycleReason:
      "lifecycle_reason" in row
        ? (row.lifecycle_reason as string | null)
        : null,
  });
}

function isSeedFixtureProblem(
  row: Pick<WritingProblemQueryRow, "tags" | "materials">,
): boolean {
  if (
    Array.isArray(row.tags) &&
    row.tags.some((tag) => tag.startsWith("seed:"))
  ) {
    return true;
  }
  if (
    row.materials &&
    typeof row.materials === "object" &&
    !Array.isArray(row.materials) &&
    "seed_source" in row.materials
  ) {
    return row.materials.seed_source === "wireframe_problem_fixtures";
  }
  return false;
}

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
  if (!isQuestionNo(questionNo) || !isProblemIdLikeUuid(currentProblemId)) {
    return null;
  }

  const supabase = await createClient();
  const findFirstEligibleProblemAfter = async (
    afterProblemId: string | null,
  ): Promise<{ problemId: string; questionNo: QuestionNo } | null> => {
    const scan = async (
      withLifecycle: boolean,
    ): Promise<{
      error: NextWritingProblemCandidateResult["error"];
      target: { problemId: string; questionNo: QuestionNo } | null;
    }> => {
      let cursor = afterProblemId;

      for (;;) {
        let query = supabase
          .from("problems")
          .select("id, question_no, tags, materials")
          .eq("domain", "writing")
          .eq("question_no", questionNo)
          .eq("publish_status", "published");

        if (withLifecycle) {
          query = query.eq("lifecycle_status", "active");
        }
        if (cursor) {
          query = query.gt("id", cursor);
        }

        const result = (await query
          .order("id", { ascending: true })
          .limit(
            MAX_VISIBILITY_SCAN_ROWS,
          )) as unknown as NextWritingProblemCandidateResult;
        if (result.error) return { error: result.error, target: null };

        const pageRows = (result.data ?? [])
          .filter((row) => isQuestionNo(row.question_no))
          .sort((a, b) => a.id.localeCompare(b.id));
        if (pageRows.length === 0) return { error: null, target: null };

        const candidates = pageRows.filter((row) => !isSeedFixtureProblem(row));
        const visibleIds = await filterVisibleProblemIds(
          supabase,
          candidates.map((row) => row.id),
        );
        const firstVisible = candidates.find((row) => visibleIds.has(row.id));
        if (firstVisible) {
          return {
            error: null,
            target: { problemId: firstVisible.id, questionNo },
          };
        }

        const nextCursor = pageRows[pageRows.length - 1]?.id ?? null;
        if (
          !nextCursor ||
          (cursor && nextCursor.localeCompare(cursor) <= 0) ||
          pageRows.length < MAX_VISIBILITY_SCAN_ROWS
        ) {
          return { error: null, target: null };
        }
        cursor = nextCursor;
      }
    };

    let result = await scan(true);
    if (result.error && result.error.message.includes("lifecycle_status")) {
      result = await scan(false);
    }
    if (result.error) {
      throw new Error(
        `getNextWritingProblemStartHref: ${result.error.message}`,
      );
    }
    return result.target;
  };

  return (
    (await findFirstEligibleProblemAfter(currentProblemId)) ??
    (await findFirstEligibleProblemAfter(null))
  );
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

async function selectDefaultWritingProblemForUser({
  questionNo,
  userId,
  supabase,
  runQuery,
  withLifecycle,
}: {
  questionNo: QuestionNo;
  userId: string;
  supabase: SupabaseServerClient;
  runQuery: RunWritingProblemQuery;
  withLifecycle: boolean;
}): Promise<{
  problem: WritingProblem | null;
  error: WritingProblemQueryResult["error"];
}> {
  for (
    let offset = 0;
    offset < MAX_VISIBILITY_SCAN_ROWS;
    offset += PROBLEM_SCAN_PAGE_SIZE
  ) {
    const result = await runQuery(withLifecycle, {
      from: offset,
      to: offset + PROBLEM_SCAN_PAGE_SIZE - 1,
    });
    if (result.error) return { problem: null, error: result.error };

    const pageRows = result.data ?? [];
    const nonSeedRows = pageRows.filter((row) => !isSeedFixtureProblem(row));
    const visibleIds = await filterVisibleProblemIds(
      supabase,
      nonSeedRows.map((row) => row.id),
    );
    const submittableProblems = nonSeedRows
      .filter((row) => visibleIds.has(row.id))
      .map((row) => normalizeWritingProblemRow(row, questionNo))
      .filter((problem) => problem.submitBlockedReason === null);

    if (submittableProblems.length > 0) {
      const touchedIds = await getTouchedWritingProblemIds(
        supabase,
        userId,
        submittableProblems.map((problem) => problem.id),
      );
      const untouched = submittableProblems.find(
        (problem) => !touchedIds.has(problem.id),
      );
      if (untouched) return { problem: untouched, error: null };
    }

    if (pageRows.length < PROBLEM_SCAN_PAGE_SIZE) break;
  }

  return { problem: null, error: null };
}

export async function getWritingProblem(
  questionNo: number,
  problemId: string | undefined,
  createClient: ClientFactory = createSupabaseServerClient,
  options: GetWritingProblemOptions = {},
): Promise<WritingProblem | null> {
  if (!isQuestionNo(questionNo)) return null;
  if (problemId && !isProblemIdLikeUuid(problemId)) return null;
  const explicitProblemId = problemId || null;
  const supabase = await createClient();
  const runQuery = async (
    withLifecycle: boolean,
    range: { from: number; to: number } | null,
  ) => {
    let query = supabase
      .from("problems")
      .select(
        withLifecycle
          ? "id, title, prompt, question_no, tags, materials, answer_key, rubric, lifecycle_status, lifecycle_reason"
          : "id, title, prompt, question_no, tags, materials, answer_key, rubric",
      )
      .eq("domain", "writing")
      .eq("question_no", questionNo)
      .eq("publish_status", "published");
    if (withLifecycle) {
      query = query.eq("lifecycle_status", "active");
    }
    // Default selection (no explicit problemId) must be deterministic and stable.
    // Order before limit so direct/deep-link entry surfaces the same published
    // candidate set and can skip incomplete rows below.
    query = query
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    const result = explicitProblemId
      ? await query.eq("id", explicitProblemId).limit(1)
      : await query.range(
          range?.from ?? 0,
          range?.to ?? PROBLEM_SCAN_PAGE_SIZE - 1,
        );
    return result as unknown as WritingProblemQueryResult;
  };

  const collectVisibleRows = async (withLifecycle: boolean) => {
    const rows: WritingProblemQueryRow[] = [];
    let lastError: WritingProblemQueryResult["error"] = null;

    if (explicitProblemId) {
      const result = await runQuery(withLifecycle, null);
      if (result.error) return result;
      const nonSeedRows = (result.data ?? []).filter(
        (row) => !isSeedFixtureProblem(row),
      );
      const visibleIds = await filterVisibleProblemIds(
        supabase,
        nonSeedRows.map((row) => row.id),
      );
      return {
        data: nonSeedRows.filter((row) => visibleIds.has(row.id)),
        error: null,
      } satisfies WritingProblemQueryResult;
    }

    for (
      let offset = 0;
      offset < MAX_VISIBILITY_SCAN_ROWS &&
      rows.length < DEFAULT_PROBLEM_CANDIDATE_LIMIT;
      offset += PROBLEM_SCAN_PAGE_SIZE
    ) {
      const result = await runQuery(withLifecycle, {
        from: offset,
        to: offset + PROBLEM_SCAN_PAGE_SIZE - 1,
      });
      if (result.error) {
        lastError = result.error;
        break;
      }
      const pageRows = result.data ?? [];
      const nonSeedRows = pageRows.filter((row) => !isSeedFixtureProblem(row));
      const visibleIds = await filterVisibleProblemIds(
        supabase,
        nonSeedRows.map((row) => row.id),
      );
      rows.push(...nonSeedRows.filter((row) => visibleIds.has(row.id)));
      if (pageRows.length < PROBLEM_SCAN_PAGE_SIZE) break;
    }

    return { data: rows, error: lastError } satisfies WritingProblemQueryResult;
  };

  if (!explicitProblemId && options.userId) {
    let userDefault = await selectDefaultWritingProblemForUser({
      questionNo,
      userId: options.userId,
      supabase,
      runQuery,
      withLifecycle: true,
    });
    if (
      userDefault.error &&
      userDefault.error.message.includes("lifecycle_status")
    ) {
      userDefault = await selectDefaultWritingProblemForUser({
        questionNo,
        userId: options.userId,
        supabase,
        runQuery,
        withLifecycle: false,
      });
    }
    if (userDefault.error) {
      throw new Error(`getWritingProblem: ${userDefault.error.message}`);
    }
    if (userDefault.problem) return userDefault.problem;
  }

  let { data, error } = await collectVisibleRows(true);
  if (error && error.message.includes("lifecycle_status")) {
    ({ data, error } = await collectVisibleRows(false));
  }
  if (error) throw new Error(`getWritingProblem: ${error.message}`);
  const problems = (data ?? []).map((row) =>
    normalizeWritingProblemRow(row, questionNo),
  );
  if (problems.length === 0) return null;
  if (!explicitProblemId) {
    return (
      problems.find((problem) => problem.submitBlockedReason === null) ??
      problems[0]
    );
  }
  return problems[0];
}

export async function getWritingProblemAvailability(
  problemId: string | null | undefined,
  createClient: ClientFactory = createSupabaseServerClient,
) {
  if (!isProblemIdLikeUuid(problemId)) return getProblemAvailability(null);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("problems")
    .select(
      "publish_status, visibility, lifecycle_status, lifecycle_reason, question_no",
    )
    .eq("id", problemId)
    .maybeSingle();
  if (error) throw new Error(`getWritingProblemAvailability: ${error.message}`);
  const row = data as ProblemAvailabilityQueryRow | null;
  const availability = getProblemAvailability(
    row
      ? {
          publishStatus: row.publish_status,
          visibility: row.visibility,
          lifecycleStatus: row.lifecycle_status,
          lifecycleReason: row.lifecycle_reason,
        }
      : null,
  );

  if (!row || !availability.canStart) {
    return availability;
  }

  if (!isQuestionNo(row.question_no)) {
    return getProblemAvailability(null);
  }

  const visible = await isWritingProblemVisibleToCaller(
    supabase,
    problemId,
    row.question_no,
  );

  return visible ? availability : getProblemAvailability(null);
}
