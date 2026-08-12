import { describe, expect, it, vi } from "vitest";
import {
  computeFallbackRecommendations,
  rankFallbackCandidates,
  type FallbackCandidate,
  type FallbackSignals,
} from "../../../src/lib/practice/recommendation-fallback";

type Row = Record<string, unknown>;

function canonicalRow(id: string, questionNo: number, tags: string[] = []) {
  return {
    problem_id: id,
    question_id: `question-${id}`,
    canonical_import_id: 101,
    payload_hash: `hash-${id}`,
    item_number: questionNo,
    topik_level: 2,
    difficulty: 3,
    title: `Question ${questionNo} ${id}`,
    prompt: "Prompt",
    tags,
    materials: {},
    source_created_at: "2026-07-13T00:00:00.000Z",
    source_updated_at: "2026-07-13T00:00:00.000Z",
  };
}

function makeClient(options: {
  canonical: Row[];
  submissions?: Row[];
  drafts?: Row[];
  dimensions?: Row[];
  goal?: Row | null;
  canonicalError?: string;
}) {
  const tables: Record<string, Row[]> = {
    writing_submissions: options.submissions ?? [],
    writing_drafts: options.drafts ?? [],
    feedback_dimension_scores: options.dimensions ?? [],
    learning_goals: options.goal ? [options.goal] : [],
  };
  const from = vi.fn((table: string) => {
    let rows = [...(tables[table] ?? [])];
    const query = {
      select: () => query,
      eq: (column: string, value: unknown) => {
        rows = rows.filter((row) => row[column] === value);
        return query;
      },
      neq: (column: string, value: unknown) => {
        rows = rows.filter((row) => row[column] !== value);
        return query;
      },
      order: () => query,
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
  return { from, rpc };
}

describe("computeFallbackRecommendations", () => {
  it("excludes attempted IDs and rotates across canonical question types", async () => {
    const client = makeClient({
      canonical: [
        canonicalRow("p51", 51),
        canonicalRow("p52", 52),
        canonicalRow("p53", 53),
        canonicalRow("p54", 54),
      ],
      submissions: [
        {
          problem_id: "p51",
          question_no: 51,
          submitted_at: "2026-07-12T00:00:00.000Z",
          user_id: "user-1",
        },
      ],
    });

    const result = await computeFallbackRecommendations(
      client as never,
      "user-1",
      null,
    );

    expect(result.items.map((item) => item.problemId)).toEqual([
      "p52",
      "p53",
      "p54",
    ]);
    expect(result.availableTypes).toEqual([52, 53, 54]);
    expect(result.summaryCode).toBe("history");
    expect(client.from).not.toHaveBeenCalledWith("problems");
  });

  it("filters canonical candidates by the requested question number", async () => {
    const client = makeClient({
      canonical: [canonicalRow("p53a", 53), canonicalRow("p53b", 53)],
    });

    const result = await computeFallbackRecommendations(
      client as never,
      "user-1",
      53,
    );

    expect(result.items).toHaveLength(2);
    expect(result.items.every((item) => item.questionNo === 53)).toBe(true);
    expect(client.rpc).toHaveBeenCalledWith("get_available_writing_questions", {
      p_item_number: 53,
      p_problem_id: null,
    });
  });

  it("surfaces canonical read failures instead of falling back to mirror rows", async () => {
    const client = makeClient({
      canonical: [],
      canonicalError: "catalog unavailable",
    });

    await expect(
      computeFallbackRecommendations(client as never, "user-1", null),
    ).rejects.toThrow("getCanonicalWritingProblems: catalog unavailable");
  });
});

describe("rankFallbackCandidates", () => {
  const candidates: FallbackCandidate[] = [
    {
      id: "p51",
      title: "51",
      questionNo: 51,
      topikLevel: 2,
      difficulty: 3,
      tags: [],
    },
    {
      id: "p52",
      title: "52",
      questionNo: 52,
      topikLevel: 2,
      difficulty: 3,
      tags: ["grammar"],
    },
    {
      id: "p53",
      title: "53",
      questionNo: 53,
      topikLevel: 2,
      difficulty: 3,
      tags: [],
    },
    {
      id: "p54",
      title: "54",
      questionNo: 54,
      topikLevel: 2,
      difficulty: 3,
      tags: [],
    },
  ];

  it("selects the next question type after the latest attempt", () => {
    const signals: FallbackSignals = {
      attemptedIds: new Set(),
      latestQuestionNo: 51,
      weakDimensions: [],
      goal: null,
    };

    expect(
      rankFallbackCandidates(candidates, signals, null)[0]?.candidate.id,
    ).toBe("p52");
  });

  it("records only weakness tags that actually overlap the candidate", () => {
    const signals: FallbackSignals = {
      attemptedIds: new Set(),
      latestQuestionNo: null,
      weakDimensions: [{ dimension: "grammar", avgScore: 0.3, sampleCount: 5 }],
      goal: null,
    };

    const ranked = rankFallbackCandidates(candidates, signals, 52);
    expect(ranked[0]).toEqual(
      expect.objectContaining({
        reasonCode: "WEAK_AREA_TAG_MATCH",
        weaknessTags: ["grammar"],
      }),
    );
  });
});
