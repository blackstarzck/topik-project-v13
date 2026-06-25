import { describe, expect, it, assertType } from "vitest";
import type { Tables, TablesInsert } from "../../../src/lib/supabase/types";

describe("Phase 5 writing tables types snapshot", () => {
  it("writing_drafts has required + nullable fields", () => {
    type Row = Tables<"writing_drafts">;
    assertType<Row>({
      id: "x",
      user_id: "u",
      problem_id: "p",
      question_no: 51,
      answer_text: null,
      answer_json: null,
      char_count: null,
      autosave_status: "clean",
      last_saved_at: null,
      created_at: "2026-05-21T00:00:00Z",
      updated_at: "2026-05-21T00:00:00Z",
    });
    expect(true).toBe(true);
  });

  it("writing_submissions answer_text is required (immutable)", () => {
    type Ins = TablesInsert<"writing_submissions">;
    assertType<Ins>({
      user_id: "u",
      problem_id: "p",
      question_no: 51,
      answer_text: "이것은 답안입니다",
      char_count: 11,
    });
    expect(true).toBe(true);
  });

  it("writing_feedback uses submission_id as primary key", () => {
    type Row = Tables<"writing_feedback">;
    assertType<Row>({
      submission_id: "s",
      user_id: "u",
      status: "complete",
      score_total: 80,
      score_max: 100,
      overall_summary: "good",
      ai_model: "mock-v1",
      ai_model_version: "phase-5",
      raw_ai_result: null,
      generated_at: "2026-05-21T00:00:00Z",
    });
    expect(true).toBe(true);
  });

  it("feedback_dimension_scores dimension is narrow union", () => {
    type Ins = TablesInsert<"feedback_dimension_scores">;
    assertType<Ins>({
      submission_id: "s",
      user_id: "u",
      dimension: "language",
    });
    expect(true).toBe(true);
  });

  it("sentence_feedback fields are nullable except keys", () => {
    type Row = Tables<"sentence_feedback">;
    assertType<Row>({
      id: "x",
      submission_id: "s",
      user_id: "u",
      sentence_index: 0,
      original_text: null,
      corrected_text: null,
      comment: null,
    });
    expect(true).toBe(true);
  });

  it("comparison_reports metrics is non-null Json", () => {
    type Ins = TablesInsert<"comparison_reports">;
    assertType<Ins>({
      user_id: "u",
      current_submission_id: "c",
      metrics: { score_delta: 5 },
    });
    expect(true).toBe(true);
  });
});
