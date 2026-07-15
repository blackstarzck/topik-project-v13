import { describe, expect, it, vi } from "vitest";
import {
  getNextProblem,
  getNextProblemBundle,
  questionRotationOrder,
} from "../../../src/lib/practice/next";

type Row = Record<string, unknown>;

function canonicalRow(id: string, itemNumber: number, difficulty = 3) {
  return {
    problem_id: id,
    question_id: `question-${id}`,
    canonical_import_id: 101,
    payload_hash: `hash-${id}`,
    item_number: itemNumber,
    topik_level: 2,
    difficulty,
    title: `Canonical ${itemNumber} ${id}`,
    prompt: "Prompt",
    tags: [],
    materials: {},
    source_created_at: "2026-07-13T00:00:00.000Z",
    source_updated_at: "2026-07-13T00:00:00.000Z",
  };
}

function makeClient(options: {
  canonical: Row[];
  recommendationItems?: Row[];
  attempts?: Row[];
  feedback?: Row[];
  dimensions?: Row[];
  profile?: Row | null;
  canonicalError?: string;
}) {
  const tables: Record<string, Row[]> = {
    recommendation_items: options.recommendationItems ?? [],
    problem_attempts: options.attempts ?? [],
    writing_submissions: [],
    writing_feedback: options.feedback ?? [],
    feedback_dimension_scores: options.dimensions ?? [],
    profiles: options.profile ? [options.profile] : [],
  };
  const from = vi.fn((table: string) => {
    let rows = [...(tables[table] ?? [])];
    const query = {
      select: () => query,
      eq: (column: string, value: unknown) => {
        rows = rows.filter((row) => row[column] === value || row[column] === undefined);
        return query;
      },
      or: () => query,
      not: () => query,
      gte: () => query,
      order: () => query,
      limit: (count: number) => {
        rows = rows.slice(0, count);
        return query;
      },
      range: (start: number, end: number) => {
        rows = rows.slice(start, end + 1);
        return query;
      },
      maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
      then: (resolve: (value: { data: Row[]; error: null; count: number }) => unknown) =>
        Promise.resolve({ data: rows, error: null, count: rows.length }).then(resolve),
    };
    return query;
  });
  const rpc = vi.fn(
    (_name: string, args: { p_item_number?: number | null; p_problem_id?: string | null }) =>
      Promise.resolve({
        data: options.canonical.filter(
          (row) =>
            (args.p_item_number == null || row.item_number === args.p_item_number) &&
            (args.p_problem_id == null || row.problem_id === args.p_problem_id),
        ),
        error: options.canonicalError ? { message: options.canonicalError } : null,
      }),
  );
  return { from, rpc };
}

describe("getNextProblem", () => {
  it("hydrates a stored recommendation from the canonical catalog", async () => {
    const client = makeClient({
      canonical: [canonicalRow("p52", 52)],
      recommendationItems: [{
        id: "item-1",
        user_id: "user-1",
        problem_id: "p52",
        rank: 1,
        reason: "Next type",
        estimated_minutes: 20,
        status: "active",
      }],
    });

    await expect(getNextProblem("user-1", async () => client as never)).resolves.toEqual({
      problemId: "p52",
      title: "Canonical 52 p52",
      domain: "writing",
      questionNo: 52,
      source: "recommendation",
      reason: "Next type",
      difficulty: 3,
      estimatedMinutes: 20,
      itemId: "item-1",
    });
    expect(client.from).not.toHaveBeenCalledWith("problems");
  });

  it("uses canonical identity to continue the latest attempted question type", async () => {
    const client = makeClient({
      canonical: [canonicalRow("p51-old", 51), canonicalRow("p51-new", 51), canonicalRow("p52", 52)],
      attempts: [{
        user_id: "user-1",
        problem_id: "p51-old",
        started_at: "2026-07-13T00:00:00.000Z",
      }],
    });

    const result = await getNextProblem("user-1", async () => client as never);

    expect(result).toEqual(expect.objectContaining({
      problemId: "p51-new",
      questionNo: 51,
      source: "same_question_no",
    }));
  });

  it("fails closed when canonical current content is unavailable", async () => {
    const client = makeClient({ canonical: [], canonicalError: "catalog unavailable" });

    await expect(getNextProblem("user-1", async () => client as never)).rejects.toThrow(
      "getCanonicalWritingProblems: catalog unavailable",
    );
  });
});

describe("getNextProblemBundle", () => {
  it("builds primary and alternatives from canonical metadata while retaining user signals", async () => {
    const client = makeClient({
      canonical: [
        canonicalRow("p51", 51),
        canonicalRow("p52", 52),
        canonicalRow("p53", 53),
        canonicalRow("p54", 54),
      ],
      recommendationItems: [
        { id: "i52", user_id: "user-1", problem_id: "p52", rank: 1, reason: "Primary", status: "active" },
        { id: "i53", user_id: "user-1", problem_id: "p53", rank: 2, reason: "Alternative", status: "active" },
      ],
      feedback: [{ user_id: "user-1", score_total: 80 }],
      dimensions: [{ user_id: "user-1", dimension: "grammar", score: 60 }],
      profile: { id: "user-1", plan_label: "premium" },
    });

    const bundle = await getNextProblemBundle("user-1", async () => client as never);

    expect(bundle.primary).toEqual(expect.objectContaining({ problemId: "p52", source: "recommendation" }));
    expect(bundle.primaryTier).toBe(1);
    expect(bundle.alternatives.map((item) => item.id)).toEqual(expect.arrayContaining(["p53", "p51", "p54"]));
    expect(bundle.summary).toEqual({
      recentSubmissions: 0,
      averageScore: 80,
      weakestDimensions: [{ dimension: "grammar", score: 60 }],
    });
  });
});

describe("questionRotationOrder", () => {
  it("keeps a deterministic 51 → 54 cycle", () => {
    expect(questionRotationOrder(52)).toEqual([53, 54, 51, 52]);
    expect(questionRotationOrder(null)).toEqual([51, 52, 53, 54]);
  });
});
