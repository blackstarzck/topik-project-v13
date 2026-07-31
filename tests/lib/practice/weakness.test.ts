import { describe, expect, it, vi } from "vitest";
import {
  getWeakDimensions,
  getWeaknessRecommendations,
} from "../../../src/lib/practice/weakness";

type Row = Record<string, unknown>;

function canonicalRow(id: string, itemNumber: number, tags: string[] = []) {
  return {
    problem_id: id,
    question_id: `question-${id}`,
    canonical_import_id: 101,
    payload_hash: `hash-${id}`,
    item_number: itemNumber,
    topik_level: 2,
    difficulty: 3,
    title: `Canonical ${itemNumber}`,
    prompt: "Prompt",
    tags,
    materials: {},
    source_created_at: "2026-07-13T00:00:00.000Z",
    source_updated_at: "2026-07-13T00:00:00.000Z",
  };
}

function makeClient(options: {
  canonical?: Row[];
  items?: Row[];
  dimensions?: Row[];
  canonicalError?: string;
}) {
  const tables: Record<string, Row[]> = {
    recommendation_items: options.items ?? [],
    feedback_dimension_scores: options.dimensions ?? [],
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
      or: () => query,
      order: () => query,
      range: (start: number, end: number) => {
        rows = rows.slice(start, end + 1);
        return query;
      },
      then: (resolve: (value: { data: Row[]; error: null }) => unknown) =>
        Promise.resolve({ data: rows, error: null }).then(resolve),
    };
    return query;
  });
  const rpc = vi.fn().mockResolvedValue({
    data: options.canonical ?? [],
    error: options.canonicalError ? { message: options.canonicalError } : null,
  });
  return { from, rpc };
}

describe("getWeakDimensions", () => {
  it("normalizes score ranges and returns only dimensions meeting the sample gate", async () => {
    const dimensions = [
      ...Array.from({ length: 5 }, () => ({
        user_id: "user-1",
        dimension: "grammar",
        score: 3,
        score_max: 10,
      })),
      ...Array.from({ length: 5 }, () => ({
        user_id: "user-1",
        dimension: "vocab",
        score: 60,
        score_max: 100,
      })),
      { user_id: "user-1", dimension: "structure", score: 1, score_max: 10 },
    ];
    const client = makeClient({ dimensions });

    await expect(
      getWeakDimensions("user-1", 5, async () => client as never),
    ).resolves.toEqual([
      { dimension: "grammar", avgScore: 0.3, sampleCount: 5 },
      { dimension: "vocab", avgScore: 0.6, sampleCount: 5 },
    ]);
  });
});

describe("getWeaknessRecommendations", () => {
  it("hydrates stored recommendation rows only when their IDs exist in canonical", async () => {
    const client = makeClient({
      canonical: [canonicalRow("p51", 51)],
      items: [
        {
          id: "visible",
          user_id: "user-1",
          problem_id: "p51",
          rank: 1,
          reason: "Grammar",
          estimated_minutes: 10,
          status: "active",
        },
        {
          id: "orphan",
          user_id: "user-1",
          problem_id: "missing",
          rank: 2,
          status: "active",
        },
      ],
    });

    await expect(
      getWeaknessRecommendations("user-1", async () => client as never),
    ).resolves.toEqual([
      {
        problemId: "p51",
        title: "Canonical 51",
        domain: "writing",
        questionNo: 51,
        rank: 1,
        reason: "Grammar",
        source: "recommendation",
        itemId: "visible",
        estimatedMinutes: 10,
      },
    ]);
    expect(client.from).not.toHaveBeenCalledWith("problems");
  });

  it("uses canonical tags for weakness fallback", async () => {
    const dimensions = Array.from({ length: 5 }, () => ({
      user_id: "user-1",
      dimension: "grammar",
      score: 20,
      score_max: 100,
    }));
    const client = makeClient({
      canonical: [
        canonicalRow("grammar-problem", 52, ["grammar"]),
        canonicalRow("content-problem", 53, ["content"]),
      ],
      dimensions,
    });

    const result = await getWeaknessRecommendations(
      "user-1",
      async () => client as never,
    );

    expect(result).toEqual([
      expect.objectContaining({
        problemId: "grammar-problem",
        source: "tag_fallback",
        questionNo: 52,
      }),
    ]);
  });

  it("propagates canonical catalog failures", async () => {
    const client = makeClient({ canonicalError: "catalog unavailable" });

    await expect(
      getWeaknessRecommendations("user-1", async () => client as never),
    ).rejects.toThrow("getCanonicalWritingProblems: catalog unavailable");
  });
});
