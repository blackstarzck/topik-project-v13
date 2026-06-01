import { describe, expect, it } from "vitest";
// @ts-expect-error — untyped .mjs audit script under test
import * as seed from "../../scripts/audit-setup/verify-seed-data.mjs";

type SubmissionRow = {
  question_no: number;
  user_id: string;
  answer_text: string;
  char_count: number;
  feedback_status: string;
};
type DimRow = { dimension: string; score: number | null; score_max: number };
type FeedbackRow = { status: string; user_id: string };
type RunRow = { source_type: string; expires_at: string };
type ItemRow = { status: string; reason: string; rank: number; problem_id: string };

const buildSubmissionRows = seed.buildSubmissionRows as (u: string) => SubmissionRow[];
const buildFeedbackRows = seed.buildFeedbackRows as (u: string) => FeedbackRow[];
const buildDimensionScoreRows = seed.buildDimensionScoreRows as (u: string) => DimRow[];
const buildRecommendationRun = seed.buildRecommendationRun as (u: string, now: number) => RunRow;
const buildRecommendationItemRows = seed.buildRecommendationItemRows as (u: string) => ItemRow[];
const DIMENSION_SCORE = seed.DIMENSION_SCORE as Record<string, number>;

const USER = "00000000-0000-4000-8000-000000000abc";
const WEAKNESS_DIMENSIONS = ["grammar", "vocab", "structure", "content", "expression", "topic_fit"];

describe("verify-seed-data pure builders", () => {
  it("builds 5 submissions with valid TOPIK question numbers and non-empty answers", () => {
    const rows = buildSubmissionRows(USER);
    expect(rows).toHaveLength(5);
    for (const row of rows) {
      expect([51, 52, 53, 54]).toContain(row.question_no);
      expect(row.user_id).toBe(USER);
      expect(row.answer_text.length).toBeGreaterThan(0);
      expect(row.char_count).toBe(row.answer_text.length);
      expect(row.feedback_status).toBe("complete");
    }
  });

  it("builds dimension scores covering all 6 dimensions with >=5 entries each", () => {
    const rows = buildDimensionScoreRows(USER);
    // 5 submissions x 6 dimensions
    expect(rows).toHaveLength(30);
    for (const dim of WEAKNESS_DIMENSIONS) {
      const entries = rows.filter((r) => r.dimension === dim);
      expect(entries.length).toBe(5); // clears getWeakDimensions threshold (5)
      expect(entries.every((r) => r.score != null && r.score_max === 100)).toBe(true);
    }
  });

  it("makes topic_fit the single weakest dimension (drives the insight Alert + validates the label fix)", () => {
    const values = Object.values(DIMENSION_SCORE);
    expect(DIMENSION_SCORE.topic_fit).toBe(Math.min(...values));
    // content second-lowest, so getWeakDimensions returns [topic_fit, content]
    const sorted = Object.entries(DIMENSION_SCORE).sort((a, b) => a[1] - b[1]);
    expect(sorted[0][0]).toBe("topic_fit");
    expect(sorted[1][0]).toBe("content");
  });

  it("builds one writing_feedback row per submission", () => {
    const rows = buildFeedbackRows(USER);
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => r.status === "complete" && r.user_id === USER)).toBe(true);
  });

  it("builds a non-expired weakness recommendation run", () => {
    const now = Date.now();
    const run = buildRecommendationRun(USER, now);
    expect(run.source_type).toBe("weakness");
    expect(new Date(run.expires_at).getTime()).toBeGreaterThan(now);
  });

  it("builds >=2 active recommendation items with ranks and non-null reasons", () => {
    const items = buildRecommendationItemRows(USER);
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items.every((i) => i.status === "active")).toBe(true);
    expect(items.every((i) => typeof i.reason === "string" && i.reason.length > 0)).toBe(true);
    expect(items.map((i) => i.rank)).toEqual([1, 2]);
    // distinct problems (UNIQUE run_id, problem_id)
    expect(new Set(items.map((i) => i.problem_id)).size).toBe(items.length);
  });
});
