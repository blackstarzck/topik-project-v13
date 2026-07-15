import { describe, expect, it, vi } from "vitest";
import { queryRecommendationBundleForUser } from "../../../src/lib/practice/recommendations";

type Row = Record<string, unknown>;

function canonicalRow(id: string, itemNumber: number, title: string) {
  return {
    problem_id: id,
    question_id: `question-${id}`,
    canonical_import_id: 101,
    payload_hash: `hash-${id}`,
    item_number: itemNumber,
    topik_level: 2,
    difficulty: 3,
    title,
    prompt: "Prompt",
    tags: [],
    materials: {},
    source_created_at: "2026-07-13T00:00:00.000Z",
    source_updated_at: "2026-07-13T00:00:00.000Z",
  };
}

function makeClient(options: {
  canonical: Row[];
  items?: Row[];
  run?: Row | null;
  canonicalError?: string;
}) {
  const order = vi.fn();
  const tables: Record<string, Row[]> = {
    recommendation_runs: options.run ? [options.run] : [],
    recommendation_items: options.items ?? [],
    writing_submissions: [],
    writing_drafts: [],
    feedback_dimension_scores: [],
    learning_goals: [],
  };
  const from = vi.fn((table: string) => {
    let rows = [...(tables[table] ?? [])];
    const query = {
      select: () => query,
      eq: (column: string, value: unknown) => {
        rows = rows.filter(
          (row) => row[column] === value || row[column] === undefined,
        );
        return query;
      },
      neq: () => query,
      or: () => query,
      order: (column: string, options?: { ascending?: boolean }) => {
        order(column, options);
        return query;
      },
      limit: (count: number) => {
        rows = rows.slice(0, count);
        return query;
      },
      range: (start: number, end: number) => {
        rows = rows.slice(start, end + 1);
        return query;
      },
      maybeSingle: () =>
        Promise.resolve({ data: rows[0] ?? null, error: null }),
      then: (resolve: (value: { data: Row[]; error: null }) => unknown) =>
        Promise.resolve({ data: rows, error: null }).then(resolve),
    };
    return query;
  });
  const rpc = vi.fn().mockResolvedValue({
    data: options.canonical,
    error: options.canonicalError ? { message: options.canonicalError } : null,
  });
  return { from, rpc, order };
}

describe("queryRecommendationBundleForUser", () => {
  it("hydrates stored recommendation identity and current content from canonical", async () => {
    const client = makeClient({
      canonical: [canonicalRow("problem-52", 52, "Canonical title")],
      run: {
        id: "run-1",
        user_id: "user-1",
        source_type: "rules",
        reason_summary: "stale text",
        created_at: "2026-07-13T00:00:00.000Z",
        expires_at: null,
      },
      items: [
        {
          id: "item-1",
          run_id: "run-1",
          user_id: "user-1",
          problem_id: "problem-52",
          rank: 1,
          reason: "Next type",
          estimated_minutes: 20,
          weakness_tags: ["grammar"],
          status: "active",
        },
      ],
    });

    const result = await queryRecommendationBundleForUser(
      "user-1",
      null,
      async () => client as never,
    );

    expect(result).toEqual({
      run: {
        reasonSummary: null,
        sourceType: "rules",
        createdAt: "2026-07-13T00:00:00.000Z",
      },
      items: [
        {
          itemId: "item-1",
          problemId: "problem-52",
          rank: 1,
          reason: "Next type",
          estimatedMinutes: 20,
          weaknessTags: ["grammar"],
          title: "Canonical title",
          questionNo: 52,
        },
      ],
      availableTypes: [52],
      source: "stored",
      summaryCode: null,
    });
    expect(client.order).toHaveBeenCalledWith("rank", { ascending: true });
    expect(client.order).toHaveBeenCalledWith("id", { ascending: true });
    expect(client.from).not.toHaveBeenCalledWith("problems");
  });

  it("uses computed canonical candidates when no stored item is usable", async () => {
    const client = makeClient({
      canonical: [canonicalRow("problem-51", 51, "Question 51")],
      items: [
        {
          id: "orphan-item",
          run_id: "run-1",
          problem_id: "missing-id",
          rank: 1,
          status: "active",
        },
      ],
    });

    const result = await queryRecommendationBundleForUser(
      "user-1",
      51,
      async () => client as never,
    );

    expect(result.source).toBe("computed");
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        itemId: null,
        problemId: "problem-51",
        title: "Question 51",
        questionNo: 51,
      }),
    );
  });

  it("propagates canonical catalog errors", async () => {
    const client = makeClient({
      canonical: [],
      canonicalError: "catalog unavailable",
    });

    await expect(
      queryRecommendationBundleForUser(
        "user-1",
        null,
        async () => client as never,
      ),
    ).rejects.toThrow("getCanonicalWritingProblems: catalog unavailable");
  });
});
