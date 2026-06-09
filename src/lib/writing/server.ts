// NOTE: server-only by convention. We do not `import "server-only"` because
// the package is not a runtime dep and vitest cannot resolve it.
import {
  createSupabaseServerClient,
  type SupabaseServerClient,
} from "../supabase/server";
import type {
  ComparisonReportRow,
  FeedbackBundle,
  QuestionNo,
  WritingDraftRow,
  WritingSubmissionRow,
} from "./types";
import { isQuestionNo } from "./types";
import {
  normalizeWritingProblem,
  type NormalizedWritingProblem,
  type ProblemLifecycleStatus,
} from "./problem-normalizer";

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

export type WritingProblem = NormalizedWritingProblem;
const DEFAULT_PROBLEM_CANDIDATE_LIMIT = 25;

type WritingProblemQueryRow = {
  id: string;
  title: string;
  prompt: string;
  question_no: number | null;
  materials: unknown;
  answer_key: unknown;
  rubric: unknown;
  lifecycle_status?: ProblemLifecycleStatus | null;
  lifecycle_reason?: string | null;
};

type WritingProblemQueryResult = {
  data: WritingProblemQueryRow[] | null;
  error: { message: string } | null;
};

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
      "lifecycle_reason" in row ? (row.lifecycle_reason as string | null) : null,
  });
}

export async function getWritingProblem(
  questionNo: number,
  problemId: string | undefined,
  createClient: ClientFactory = createSupabaseServerClient,
): Promise<WritingProblem | null> {
  if (!isQuestionNo(questionNo)) return null;
  const supabase = await createClient();
  const runQuery = async (withLifecycle: boolean) => {
    let query = supabase
      .from("problems")
      .select(
        withLifecycle
          ? "id, title, prompt, question_no, materials, answer_key, rubric, lifecycle_status, lifecycle_reason"
          : "id, title, prompt, question_no, materials, answer_key, rubric",
      )
      .eq("domain", "writing")
      .eq("question_no", questionNo)
      .eq("publish_status", "published");
    if (withLifecycle) {
      query = query.eq("lifecycle_status", "active");
    }
    // Default selection (no explicit problemId) must be DETERMINISTIC and stable.
    // Without an ORDER BY, `.limit(1)` returns an arbitrary published row, so a
    // direct/deep-link entry could surface a different (or incomplete) problem on
    // each request. Order before limit so the default question always loads the
    // same published problem.
    query = query
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(problemId ? 1 : DEFAULT_PROBLEM_CANDIDATE_LIMIT);
    const result = problemId ? await query.eq("id", problemId) : await query;
    return result as unknown as WritingProblemQueryResult;
  };

  let { data, error } = await runQuery(true);
  if (error && error.message.includes("lifecycle_status")) {
    ({ data, error } = await runQuery(false));
  }
  if (error) throw new Error(`getWritingProblem: ${error.message}`);
  const problems = (data ?? []).map((row) =>
    normalizeWritingProblemRow(row, questionNo),
  );
  if (problems.length === 0) return null;
  if (problemId) return problems[0];
  return (
    problems.find((problem) => problem.submitBlockedReason === null) ??
    problems[0]
  );
}
