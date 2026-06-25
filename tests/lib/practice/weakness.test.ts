import { describe, expect, it } from "vitest";
import {
  getWeakDimensions,
  getWeaknessRecommendations,
  WEAKNESS_DIMENSIONS,
} from "../../../src/lib/practice/weakness";

type FeedbackRow = {
  dimension: string;
  score: number | null;
  score_max: number | null;
};

type RecItem = {
  id: string;
  problem_id: string;
  rank: number;
  reason: string | null;
  weakness_tags: string[] | null;
  recommendation_runs: { expires_at: string | null } | null;
  problems: {
    id: string;
    title: string;
    domain: string;
    question_no: number | null;
    publish_status: string;
    lifecycle_status?: string;
  } | null;
};

type ProblemRow = {
  id: string;
  title: string;
  domain: string;
  question_no: number | null;
  tags?: string[];
};

/**
 * Lightweight in-memory Supabase stub. We build only the chain shapes the
 * weakness helpers actually call:
 *   - feedback_dimension_scores: .select(...).eq(user_id, ...) → awaitable
 *   - recommendation_items:      .select(...).eq().eq().or().order().limit() → awaitable
 *   - problems:                  .select(...).eq().overlaps().order().limit() → awaitable
 */
function makeClient(opts: {
  feedback?: FeedbackRow[];
  feedbackError?: { message: string } | null;
  recItems?: RecItem[];
  recItemsError?: { message: string } | null;
  problems?: ProblemRow[];
  problemsError?: { message: string } | null;
}) {
  const calls: {
    overlaps?: { column: string; values: string[] };
    problemEq?: { column: string; value: unknown }[];
    recOrder?: boolean;
  } = {};
  const client = {
    __calls: calls,
    from(table: string) {
      if (table === "feedback_dimension_scores") {
        return {
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: opts.feedback ?? [],
                error: opts.feedbackError ?? null,
              }),
          }),
        };
      }
      if (table === "recommendation_items") {
        const chain = {
          eq: () => chain,
          or: () => chain,
          order: () => chain,
          limit: () =>
            Promise.resolve({
              data: opts.recItems ?? [],
              error: opts.recItemsError ?? null,
            }),
        };
        return {
          select: () => chain,
        };
      }
      if (table === "problems") {
        const chain = {
          eq: (column: string, value: unknown) => {
            calls.problemEq = [...(calls.problemEq ?? []), { column, value }];
            return chain;
          },
          overlaps: (column: string, values: string[]) => {
            calls.overlaps = { column, values };
            return chain;
          },
          order: () => chain,
          limit: () =>
            Promise.resolve({
              data: opts.problems ?? [],
              error: opts.problemsError ?? null,
            }),
        };
        return {
          select: () => chain,
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  return client;
}

describe("getWeakDimensions", () => {
  it("excludes dimensions with fewer than `threshold` samples (gate)", async () => {
    // grammar has 3 scored rows — should be excluded with default threshold=5.
    const feedback: FeedbackRow[] = [
      { dimension: "grammar", score: 40, score_max: 100 },
      { dimension: "grammar", score: 50, score_max: 100 },
      { dimension: "grammar", score: 30, score_max: 100 },
    ];
    const create = async () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeClient({ feedback }) as any;
    const out = await getWeakDimensions("user-1", 5, create);
    expect(out).toEqual([]);
  });

  it("returns exactly the bottom-2 dimensions by avg score, ascending", async () => {
    // 5 rows per dimension to clear the default gate.
    const feedback: FeedbackRow[] = [
      ...row("grammar", [80, 80, 80, 80, 80]),
      ...row("vocab", [40, 40, 40, 40, 40]), // weakest
      ...row("structure", [70, 70, 70, 70, 70]),
      ...row("content", [50, 50, 50, 50, 50]), // 2nd weakest
      ...row("expression", [90, 90, 90, 90, 90]),
      ...row("topic_fit", [60, 60, 60, 60, 60]),
    ];
    const create = async () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeClient({ feedback }) as any;
    const out = await getWeakDimensions("user-1", 5, create);
    expect(out).toHaveLength(2);
    expect(out.map((d) => d.dimension)).toEqual(["vocab", "content"]);
    expect(out[0].avgScore).toBeLessThan(out[1].avgScore);
  });

  it("returns empty when there are no scored rows at all (extra fallback)", async () => {
    const create = async () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeClient({ feedback: [] }) as any;
    const out = await getWeakDimensions("user-1", 5, create);
    expect(out).toEqual([]);
  });

  it("ignores null scores when counting toward the threshold", async () => {
    // grammar has 6 rows but only 4 non-null scores — should not pass gate=5.
    const feedback: FeedbackRow[] = [
      { dimension: "grammar", score: 40, score_max: 100 },
      { dimension: "grammar", score: 50, score_max: 100 },
      { dimension: "grammar", score: null, score_max: 100 },
      { dimension: "grammar", score: 60, score_max: 100 },
      { dimension: "grammar", score: 30, score_max: 100 },
      { dimension: "grammar", score: null, score_max: 100 },
    ];
    const create = async () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeClient({ feedback }) as any;
    const out = await getWeakDimensions("user-1", 5, create);
    expect(out).toEqual([]);
  });

  it("exposes the canonical 7-dimension catalog", () => {
    expect([...WEAKNESS_DIMENSIONS].sort()).toEqual([
      "content",
      "expression",
      "grammar",
      "language",
      "structure",
      "topic_fit",
      "vocab",
    ]);
  });
});

describe("getWeaknessRecommendations", () => {
  it("returns up to 4 recommendation_items when active items exist (tier 1)", async () => {
    const recItems: RecItem[] = [
      makeItem("i-1", "p-1", 1),
      makeItem("i-2", "p-2", 2),
      makeItem("i-3", "p-3", 3),
      makeItem("i-4", "p-4", 4),
    ];
    const create = async () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeClient({ recItems }) as any;
    const out = await getWeaknessRecommendations("user-1", create);
    expect(out).toHaveLength(4);
    expect(out[0].source).toBe("recommendation");
    expect(out.map((r) => r.problemId)).toEqual(["p-1", "p-2", "p-3", "p-4"]);
  });

  it("ignores recommendation_items whose joined problem is not active", async () => {
    const recItems: RecItem[] = [
      makeItem("i-1", "p-inactive", 1, "inactive"),
      makeItem("i-2", "p-active", 2, "active"),
    ];
    const create = async () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeClient({ recItems }) as any;

    const out = await getWeaknessRecommendations("user-1", create);

    expect(out).toHaveLength(1);
    expect(out[0].problemId).toBe("p-active");
  });

  it("falls back to tag-overlap query when recommendation_items is empty (tier 2)", async () => {
    // Sufficient feedback to compute weak dimensions so the fallback survives
    // the threshold gate.
    const feedback: FeedbackRow[] = [
      ...row("vocab", [40, 40, 40, 40, 40]),
      ...row("content", [50, 50, 50, 50, 50]),
      ...row("grammar", [90, 90, 90, 90, 90]),
    ];
    const problems: ProblemRow[] = [
      { id: "p-fallback-1", title: "T1", domain: "writing", question_no: 53 },
      { id: "p-fallback-2", title: "T2", domain: "writing", question_no: 54 },
    ];
    const client = makeClient({ recItems: [], feedback, problems });
    const create = async () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any;

    const out = await getWeaknessRecommendations("user-1", create);
    expect(out).toHaveLength(2);
    expect(out.every((r) => r.source === "tag_fallback")).toBe(true);
    // The overlaps() call must have used the weak dimensions as tags.
    expect(client.__calls.overlaps?.column).toBe("tags");
    expect(client.__calls.overlaps?.values.sort()).toEqual([
      "content",
      "vocab",
    ]);
    expect(client.__calls.problemEq).toContainEqual({
      column: "lifecycle_status",
      value: "active",
    });
  });

  it("returns [] when neither recommendation_items nor weak dimensions exist", async () => {
    // No items, and feedback below threshold so weak dimensions == [].
    const create = async () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeClient({ recItems: [], feedback: [] }) as any;
    const out = await getWeaknessRecommendations("user-1", create);
    expect(out).toEqual([]);
  });
});

function row(dim: string, scores: number[]): FeedbackRow[] {
  return scores.map((s) => ({ dimension: dim, score: s, score_max: 100 }));
}

function makeItem(
  id: string,
  problemId: string,
  rank: number,
  lifecycleStatus = "active",
): RecItem {
  return {
    id,
    problem_id: problemId,
    rank,
    reason: null,
    weakness_tags: null,
    recommendation_runs: { expires_at: null },
    problems: {
      id: problemId,
      title: `Problem ${problemId}`,
      domain: "writing",
      question_no: 53,
      publish_status: "published",
      lifecycle_status: lifecycleStatus,
    },
  };
}
