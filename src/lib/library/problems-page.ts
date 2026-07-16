// NOTE: Server-only by convention. This module is consumed by the
// `/library/problems` RSC and keeps the page data contract out of client code.
import {
  createSupabaseServerClient,
  type SupabaseServerClient,
} from "../supabase/server";
import { isDashboardContinueDraftCandidate } from "../writing/dashboard-drafts";
import { getCanonicalWritingProblems } from "../writing/canonical-source";
import type { WritingDraftRow } from "../writing/types";
import type {
  LibraryDraftView,
  LibraryItemView,
  LibraryProblemView,
  LibrarySubmissionView,
} from "./types";
import { listLibraryItems } from "./server";

type ClientFactory = () => Promise<SupabaseServerClient>;

export type LibraryProblemsPageData = {
  initialSubmissions: LibrarySubmissionView[];
  initialProblems: LibraryProblemView[];
  initialDrafts: LibraryDraftView[];
};

type LibraryDraftProblemRow = {
  id: string;
  title: string | null;
  question_no: number | null;
};

export async function getLibraryProblemsPageData(
  userId: string,
  createClient: ClientFactory = createSupabaseServerClient,
): Promise<LibraryProblemsPageData> {
  const supabase = await createClient();
  const sameClient = async () => supabase;
  const [submissions, problems, drafts] = await Promise.all([
    listLibraryItems(userId, "submissions", sameClient),
    listLibraryItems(userId, "problems", sameClient),
    listLibraryProblemDrafts(userId, sameClient),
  ]);

  return {
    initialSubmissions: submissions.filter(isSubmission),
    initialProblems: problems.filter(isProblem),
    initialDrafts: drafts,
  };
}

export async function listLibraryProblemDrafts(
  userId: string,
  createClient: ClientFactory = createSupabaseServerClient,
): Promise<LibraryDraftView[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("writing_drafts")
    .select(
      "id, problem_id, question_no, answer_text, answer_json, char_count, autosave_status, last_saved_at, created_at, updated_at",
    )
    .eq("user_id", userId)
    .neq("autosave_status", "superseded")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`listLibraryProblemDrafts: ${error.message}`);
  }

  const drafts = ((data ?? []) as WritingDraftRow[]).filter((row) =>
    isDashboardContinueDraftCandidate(row),
  );
  if (drafts.length === 0) return [];

  const draftProblemIds = uniqueIds(drafts.map((row) => row.problem_id));
  const requestedIds = new Set(draftProblemIds);
  const problemRows: LibraryDraftProblemRow[] = (
    await getCanonicalWritingProblems({ supabase })
  )
    .filter((problem) => requestedIds.has(problem.id))
    .map((problem) => ({
      id: problem.id,
      title: problem.title,
      question_no: problem.questionNo,
    }));

  const problemById = new Map(problemRows.map((row) => [row.id, row]));

  return drafts.map((row) => {
    const problem = problemById.get(row.problem_id);
    return {
      kind: "draft",
      id: row.id,
      problem_id: row.problem_id,
      problem_title: problem?.title ?? null,
      question_no:
        typeof problem?.question_no === "number"
          ? problem.question_no
          : row.question_no,
      answer_text: row.answer_text,
      char_count: row.char_count,
      autosave_status: row.autosave_status,
      item_id: `draft:${row.id}`,
      saved_at: row.last_saved_at ?? row.updated_at,
      last_saved_at: row.last_saved_at,
    };
  });
}

function isSubmission(item: LibraryItemView): item is LibrarySubmissionView {
  return item.kind === "submission";
}

function isProblem(item: LibraryItemView): item is LibraryProblemView {
  return item.kind === "problem";
}

function uniqueIds(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}
