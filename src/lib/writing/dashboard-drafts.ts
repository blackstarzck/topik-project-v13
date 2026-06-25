import type { Json } from "../supabase/types";
import {
  isLongFormDraftJson,
  isShortAnswer51DraftJson,
  isShortAnswer52DraftJson,
} from "./types";

export type DashboardContinueDraft = {
  problemId: string;
  title: string;
  questionNo: number | null;
  lastSavedAt: string | null;
};

export type DashboardContinueDraftProblemJoin = {
  title: string;
  question_no: number | null;
};

export type DashboardContinueDraftQueryRow = {
  problem_id: string;
  question_no: number | null;
  answer_text: string | null;
  answer_json: Json | null;
  char_count: number | null;
  autosave_status: string | null;
  last_saved_at: string | null;
  updated_at: string | null;
  problems:
    | DashboardContinueDraftProblemJoin
    | DashboardContinueDraftProblemJoin[]
    | null;
};

function pickJoinedOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function hasText(value: string | null | undefined): boolean {
  return (value ?? "").trim().length > 0;
}

function hasMeaningfulDraftJson(value: unknown): boolean {
  if (isShortAnswer51DraftJson(value) || isShortAnswer52DraftJson(value)) {
    return Object.values(value.blanks).some(hasText);
  }

  if (!isLongFormDraftJson(value)) return false;

  if (value._v === "53.v1") {
    return Object.values(value.sections).some(hasText);
  }

  return hasText(value.text);
}

export function isDashboardContinueDraftCandidate(
  row: Pick<
    DashboardContinueDraftQueryRow,
    "answer_text" | "answer_json" | "autosave_status"
  >,
): boolean {
  if (row.autosave_status === "superseded") return false;
  return hasText(row.answer_text) || hasMeaningfulDraftJson(row.answer_json);
}

export function pickDashboardContinueDraft(
  rows: DashboardContinueDraftQueryRow[],
): DashboardContinueDraft | null {
  for (const row of rows) {
    if (!isDashboardContinueDraftCandidate(row)) continue;

    const problem = pickJoinedOne(row.problems);
    if (!problem) continue;

    return {
      problemId: row.problem_id,
      title: problem.title,
      questionNo: problem.question_no ?? row.question_no,
      lastSavedAt: row.last_saved_at,
    };
  }

  return null;
}
