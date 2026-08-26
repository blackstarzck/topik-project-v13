// Server-only dashboard queries. Keep dashboard assembly in dashboard-builder.
import {
  createSupabaseServerClient,
  type SupabaseServerClient,
} from "../supabase/server";
import { getCanonicalWritingProblems } from "../writing/canonical-source";
import type {
  DimensionScoreDashboardRow,
  FeedbackDashboardRow,
  LibraryDashboardRows,
  LibraryItemDashboardRow,
  NonWritingProblemDashboardRow,
  ProblemDashboardRow,
  SubmissionDashboardRow,
  SubmissionProblemRow,
  WritingSubmissionHistoryRow,
} from "./dashboard-builder";
import {
  parseLibraryDashboardTimelineEvent,
  TIMELINE_EVENT_TYPES,
} from "./dashboard-timeline";
import type {
  ComparisonReportDashboardRow,
  ExportFileDashboardRow,
  ParsedLibraryDashboardTimelineEvent,
  StudyEventDashboardRow,
  TimelineSubmissionRow,
} from "./dashboard-timeline";

export type ClientFactory = () => Promise<SupabaseServerClient>;

export async function queryLibraryDashboardRows(
  userId: string,
  createClient: ClientFactory = createSupabaseServerClient,
): Promise<LibraryDashboardRows> {
  const supabase = await createClient();

  const { data: libraryItems, error: libraryError } = await supabase
    .from("library_items")
    .select("id, item_type, problem_id, saved_at, submission_id")
    .eq("user_id", userId)
    .order("saved_at", { ascending: false });
  if (libraryError) {
    throw new Error(
      `getLibraryDashboard(library_items): ${libraryError.message}`,
    );
  }

  const savedSubmissionIds = uniqueIds(
    (libraryItems ?? [])
      .filter((item) => item.item_type === "submission")
      .map((item) => item.submission_id),
  );

  const [submissions, feedback, dimensionScores, allSubmissions, studyEvents] =
    await Promise.all([
      fetchSavedSubmissions(supabase, savedSubmissionIds),
      fetchFeedback(supabase, savedSubmissionIds),
      fetchDimensionScores(supabase, savedSubmissionIds),
      fetchAllSubmissionProblemRows(supabase, userId),
      fetchTimelineEvents(supabase, userId),
    ]);

  const parsedTimelineEvents = studyEvents.map((event) =>
    parseLibraryDashboardTimelineEvent(event),
  );
  const exportFiles = await fetchExportFiles(
    supabase,
    collectTimelineExportIds(parsedTimelineEvents),
  );
  const comparisonReports = await fetchComparisonReports(
    supabase,
    collectTimelineReportIds(parsedTimelineEvents, exportFiles),
  );
  const timelineSubmissionIds = collectTimelineSubmissionIds(
    studyEvents,
    comparisonReports,
    exportFiles,
  );
  const timelineSubmissions = await fetchTimelineSubmissions(
    supabase,
    timelineSubmissionIds,
  );
  const problemIds = uniqueIds([
    ...submissions.map((row) => row.problem_id),
    ...(libraryItems ?? []).map((row) => row.problem_id),
    ...studyEvents.map((row) => row.problem_id),
    ...parsedTimelineEvents.map((event) => event?.payloadProblemId),
    ...timelineSubmissions.map((row) => row.problem_id),
  ]);
  const requestedIds = new Set(problemIds);
  const nonWritingRows = await fetchNonWritingProblems(supabase, problemIds);
  const nonWritingIds = new Set(nonWritingRows.map((problem) => problem.id));
  const unresolvedIds = problemIds.filter((id) => !nonWritingIds.has(id));
  const canonicalProblems: ProblemDashboardRow[] = (
    unresolvedIds.length > 0
      ? await getCanonicalWritingProblems({ supabase })
      : []
  )
    .filter((problem) => requestedIds.has(problem.id))
    .map((problem) => ({
      id: problem.id,
      question_no: problem.questionNo,
      title: problem.title,
      difficulty: problem.difficulty ?? null,
    }));
  const nonWritingProblems: ProblemDashboardRow[] = nonWritingRows.map(
    ({ id, question_no, title, difficulty }) => ({
      id,
      question_no,
      title,
      difficulty,
    }),
  );
  const problems = [...nonWritingProblems, ...canonicalProblems];
  const visibleProblemIds = new Set([
    ...canonicalProblems.map((problem) => problem.id),
    ...nonWritingRows
      .filter(isVisibleNonWritingProblem)
      .map((problem) => problem.id),
  ]);

  return {
    libraryItems: (libraryItems ?? []) as LibraryItemDashboardRow[],
    submissions,
    feedback,
    dimensionScores,
    problems,
    allSubmissions,
    timelineSubmissions,
    studyEvents,
    comparisonReports,
    exportFiles,
    visibleProblemIds: [...visibleProblemIds],
  };
}

async function fetchNonWritingProblems(
  supabase: SupabaseServerClient,
  ids: string[],
): Promise<NonWritingProblemDashboardRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("problems")
    .select(
      "id, question_no, title, difficulty, publish_status, visibility, lifecycle_status",
    )
    .in("id", ids)
    .neq("domain", "writing");
  if (error) {
    throw new Error(
      `getLibraryDashboard(non-writing problems): ${error.message}`,
    );
  }
  return (data ?? []) as NonWritingProblemDashboardRow[];
}

function isVisibleNonWritingProblem(
  problem: NonWritingProblemDashboardRow,
): boolean {
  return (
    problem.publish_status === "published" &&
    problem.lifecycle_status === "active" &&
    problem.visibility !== "private"
  );
}

async function fetchSavedSubmissions(
  supabase: SupabaseServerClient,
  ids: string[],
): Promise<SubmissionDashboardRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("writing_submissions")
    .select(
      "id, problem_id, question_no, char_count, submitted_at, feedback_status, parent_submission_id",
    )
    .in("id", ids);
  if (error) {
    throw new Error(
      `getLibraryDashboard(writing_submissions): ${error.message}`,
    );
  }
  const historyTitles = await fetchHistoryTitles(supabase, ids);
  return ((data ?? []) as SubmissionDashboardRow[]).map((row) => ({
    ...row,
    history_title: historyTitles.get(row.id) ?? null,
  }));
}

async function fetchFeedback(
  supabase: SupabaseServerClient,
  ids: string[],
): Promise<FeedbackDashboardRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("writing_feedback")
    .select("submission_id, status, score_total, score_max, generated_at")
    .in("submission_id", ids);
  if (error) {
    throw new Error(`getLibraryDashboard(writing_feedback): ${error.message}`);
  }
  return (data ?? []) as FeedbackDashboardRow[];
}

async function fetchDimensionScores(
  supabase: SupabaseServerClient,
  ids: string[],
): Promise<DimensionScoreDashboardRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("feedback_dimension_scores")
    .select(
      "id, submission_id, dimension, score, score_max, summary, weakness_level",
    )
    .in("submission_id", ids);
  if (error) {
    throw new Error(
      `getLibraryDashboard(feedback_dimension_scores): ${error.message}`,
    );
  }
  return (data ?? []) as DimensionScoreDashboardRow[];
}

async function fetchAllSubmissionProblemRows(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<SubmissionProblemRow[]> {
  const { data, error } = await supabase
    .from("writing_submissions")
    .select("id, problem_id, question_no, parent_submission_id")
    .eq("user_id", userId)
    .order("submitted_at", { ascending: false })
    .limit(500);
  if (error) {
    throw new Error(
      `getLibraryDashboard(all writing_submissions): ${error.message}`,
    );
  }
  return (data ?? []) as SubmissionProblemRow[];
}

async function fetchTimelineEvents(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<StudyEventDashboardRow[]> {
  const { data, error } = await supabase
    .from("study_events")
    .select("id, event_type, occurred_at, problem_id, submission_id, payload")
    .eq("user_id", userId)
    .in("event_type", [...TIMELINE_EVENT_TYPES])
    .order("occurred_at", { ascending: false })
    .limit(12);
  if (error) {
    throw new Error(`getLibraryDashboard(study_events): ${error.message}`);
  }
  return (data ?? []) as StudyEventDashboardRow[];
}

async function fetchComparisonReports(
  supabase: SupabaseServerClient,
  ids: string[],
): Promise<ComparisonReportDashboardRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("comparison_reports")
    .select("id, current_submission_id")
    .in("id", ids);
  if (error) {
    throw new Error(
      `getLibraryDashboard(comparison_reports): ${error.message}`,
    );
  }
  return (data ?? []) as ComparisonReportDashboardRow[];
}

async function fetchExportFiles(
  supabase: SupabaseServerClient,
  ids: string[],
): Promise<ExportFileDashboardRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("export_files")
    .select("id, source_type, source_id")
    .in("id", ids);
  if (error) {
    throw new Error(`getLibraryDashboard(export_files): ${error.message}`);
  }
  return (data ?? []) as ExportFileDashboardRow[];
}

async function fetchTimelineSubmissions(
  supabase: SupabaseServerClient,
  ids: string[],
): Promise<TimelineSubmissionRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("writing_submissions")
    .select("id, problem_id, question_no")
    .in("id", ids);
  if (error) {
    throw new Error(
      `getLibraryDashboard(timeline writing_submissions): ${error.message}`,
    );
  }
  const historyTitles = await fetchHistoryTitles(supabase, ids);
  return ((data ?? []) as TimelineSubmissionRow[]).map((row) => ({
    ...row,
    history_title: historyTitles.get(row.id) ?? null,
  }));
}

async function fetchHistoryTitles(
  supabase: SupabaseServerClient,
  ids: string[],
): Promise<Map<string, string | null>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase.rpc(
    "get_writing_submission_history_context",
    { p_submission_ids: ids },
  );
  if (error) {
    throw new Error(
      `getLibraryDashboard(submission history): ${error.message}`,
    );
  }
  return new Map(
    ((data ?? []) as WritingSubmissionHistoryRow[]).map((row) => [
      row.submission_id,
      row.title,
    ]),
  );
}

function collectTimelineExportIds(
  parsedEvents: Array<ParsedLibraryDashboardTimelineEvent | null>,
): string[] {
  return uniqueIds(parsedEvents.map((event) => event?.exportId));
}

function collectTimelineReportIds(
  parsedEvents: Array<ParsedLibraryDashboardTimelineEvent | null>,
  exportFiles: ExportFileDashboardRow[],
): string[] {
  return uniqueIds([
    ...parsedEvents.map((event) => event?.directReportId),
    ...parsedEvents.map((event) => event?.sourceReportId),
    ...exportFiles.map((file) =>
      file.source_type === "report" ? file.source_id : null,
    ),
  ]);
}

function collectTimelineSubmissionIds(
  events: StudyEventDashboardRow[],
  comparisonReports: ComparisonReportDashboardRow[],
  exportFiles: ExportFileDashboardRow[],
): string[] {
  const comparisonReportsById = new Map(
    comparisonReports.map((row) => [row.id, row]),
  );
  const exportFilesById = new Map(exportFiles.map((row) => [row.id, row]));
  const parsedEvents = events.map((event) =>
    parseLibraryDashboardTimelineEvent(event, {
      comparisonReportsById,
      exportFilesById,
    }),
  );

  return uniqueIds([
    ...parsedEvents.map((event) => event?.directSubmissionId),
    ...parsedEvents.map((event) => event?.resolvedPayloadSubmissionId),
  ]);
}

function uniqueIds(values: Array<string | null | undefined>): string[] {
  const set = new Set<string>();
  for (const value of values) {
    if (value) set.add(value);
  }
  return Array.from(set);
}
