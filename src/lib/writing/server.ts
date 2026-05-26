// NOTE: server-only by convention. We do not `import "server-only"` because
// the package is not a runtime dep and vitest cannot resolve it.
import {
  createSupabaseServerClient,
  type SupabaseServerClient,
} from "../supabase/server";
import type {
  ComparisonReportRow,
  FeedbackBundle,
  WritingDraftRow,
  WritingSubmissionRow,
} from "./types";

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

// Phase 7 Task 3 (P0-3) — problem.materials shape for 53번 chart rendering.
// Codex Round 1 P1-PLAN-3 required exposing materials in getWritingProblem.
export type WritingProblemMaterials =
  | { chart: { type: "bar" | "line" | "pie"; data: unknown[]; options?: Record<string, unknown> } }
  | { text: string }
  | null;

export type WritingProblem = {
  id: string;
  title: string;
  prompt: string;
  materials: WritingProblemMaterials;
};

export async function getWritingProblem(
  questionNo: number,
  problemId: string | undefined,
  createClient: ClientFactory = createSupabaseServerClient,
): Promise<WritingProblem | null> {
  const supabase = await createClient();
  const base = supabase
    .from("problems")
    .select("id, title, prompt, materials")
    .eq("domain", "writing")
    .eq("question_no", questionNo)
    .eq("publish_status", "published")
    .limit(1);
  const { data, error } = problemId
    ? await base.eq("id", problemId)
    : await base;
  if (error) throw new Error(`getWritingProblem: ${error.message}`);
  const row = data?.[0];
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    prompt: row.prompt,
    materials: row.materials as WritingProblemMaterials,
  };
}
