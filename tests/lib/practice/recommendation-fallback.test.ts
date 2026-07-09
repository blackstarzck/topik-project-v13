import { describe, expect, it } from "vitest";
import {
  computeFallbackRecommendations,
  rankFallbackCandidates,
  type FallbackCandidate,
  type FallbackSignals,
} from "../../../src/lib/practice/recommendation-fallback";
import type { SupabaseServerClient } from "../../../src/lib/supabase/server";
import type { QuestionNo } from "../../../src/lib/practice/types";

type ProblemRowFx = {
  id: string;
  title: string;
  question_no: number;
  topik_level: number | null;
  difficulty: number | null;
  tags: string[] | null;
  materials: unknown;
};

type WritingSubmissionFx = {
  problem_id: string;
  question_no: number | null;
  submitted_at?: string;
};

type WritingDraftFx = {
  problem_id: string;
  question_no: number | null;
  updated_at?: string;
  autosave_status?: "clean" | "dirty" | "syncing" | "failed" | "superseded";
};

type DimensionScoreFx = {
  dimension: string;
  score: number | null;
  score_max: number | null;
};

type ClientOpts = {
  submissions?: WritingSubmissionFx[];
  drafts?: WritingDraftFx[];
  problems?: ProblemRowFx[];
  visibleProblemIds?: string[];
  dimensionScores?: DimensionScoreFx[];
  dimensionError?: { message: string };
  goal?: { topik_level: "TOPIK_I" | "TOPIK_II"; target_grade: number } | null;
  goalError?: { message: string };
  /** Simulate envs where problems.lifecycle_status does not exist. */
  lifecycleColumnMissing?: boolean;
};

type ClientCalls = {
  problemQueries: number;
  lifecycleFilteredQueries: number;
  rpcBatches: string[][];
};

function makeClient(opts: ClientOpts): {
  client: SupabaseServerClient;
  calls: ClientCalls;
} {
  const calls: ClientCalls = {
    problemQueries: 0,
    lifecycleFilteredQueries: 0,
    rpcBatches: [],
  };

  const client = {
    rpc(name: string, args: { p_problem_ids?: string[] }) {
      if (name !== "filter_visible_writing_problem_ids") {
        throw new Error(`unexpected rpc ${name}`);
      }
      calls.rpcBatches.push(args.p_problem_ids ?? []);
      const allowed = new Set(
        opts.visibleProblemIds ?? args.p_problem_ids ?? [],
      );
      return Promise.resolve({
        data: (args.p_problem_ids ?? [])
          .filter((id) => allowed.has(id))
          .map((id) => ({ problem_id: id })),
        error: null,
      });
    },
    from(table: string) {
      if (table === "writing_submissions") {
        const rows = (opts.submissions ?? []).map((submission) => ({
          problem_id: submission.problem_id,
          question_no: submission.question_no,
          submitted_at:
            submission.submitted_at ?? "2026-07-01T00:00:00.000Z",
        }));
        const chain = {
          eq: () => chain,
          order: () => Promise.resolve({ data: rows, error: null }),
        };
        return { select: () => chain };
      }
      if (table === "writing_drafts") {
        const rows = (opts.drafts ?? []).map((draft) => ({
          problem_id: draft.problem_id,
          question_no: draft.question_no,
          updated_at: draft.updated_at ?? "2026-07-01T00:00:00.000Z",
          autosave_status: draft.autosave_status ?? "dirty",
        }));
        let excludedStatus: string | null = null;
        const chain = {
          eq: () => chain,
          neq: (column: string, value: string) => {
            if (column === "autosave_status") excludedStatus = value;
            return chain;
          },
          order: () =>
            Promise.resolve({
              data: rows.filter((row) => row.autosave_status !== excludedStatus),
              error: null,
            }),
        };
        return { select: () => chain };
      }
      if (table === "feedback_dimension_scores") {
        return {
          select: () => ({
            eq: () =>
              Promise.resolve(
                opts.dimensionError
                  ? { data: null, error: opts.dimensionError }
                  : { data: opts.dimensionScores ?? [], error: null },
              ),
          }),
        };
      }
      if (table === "learning_goals") {
        const chain = {
          eq: () => chain,
          maybeSingle: () =>
            Promise.resolve(
              opts.goalError
                ? { data: null, error: opts.goalError }
                : { data: opts.goal ?? null, error: null },
            ),
        };
        return { select: () => chain };
      }
      if (table === "problems") {
        calls.problemQueries += 1;
        let questionNoFilter: number | null = null;
        let lifecycleFiltered = false;
        const chain = {
          eq: (column: string, value: unknown) => {
            if (column === "question_no" && typeof value === "number") {
              questionNoFilter = value;
            }
            if (column === "lifecycle_status") {
              lifecycleFiltered = true;
              calls.lifecycleFilteredQueries += 1;
            }
            return chain;
          },
          order: () => chain,
          range: (from: number, to: number) => {
            if (lifecycleFiltered && opts.lifecycleColumnMissing) {
              return Promise.resolve({
                data: null,
                error: {
                  message:
                    "column problems.lifecycle_status does not exist",
                },
              });
            }
            const rows = (opts.problems ?? []).filter(
              (row) =>
                questionNoFilter == null ||
                row.question_no === questionNoFilter,
            );
            return Promise.resolve({
              data: rows.slice(from, to + 1),
              error: null,
            });
          },
        };
        return { select: () => chain };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };

  return { client: client as never, calls };
}

function problem(
  id: string,
  questionNo: number,
  overrides: Partial<ProblemRowFx> = {},
): ProblemRowFx {
  return {
    id,
    title: `Problem ${id}`,
    question_no: questionNo,
    topik_level: 2,
    difficulty: 3,
    tags: [],
    materials: null,
    ...overrides,
  };
}

/** 5 scored rows per dimension so the >=5 sample gate passes. */
function dimensionRows(dimension: string, score: number): DimensionScoreFx[] {
  return Array.from({ length: 5 }, () => ({
    dimension,
    score,
    score_max: 100,
  }));
}

const FOUR_TYPE_PROBLEMS: ProblemRowFx[] = [
  problem("p-51-a", 51),
  problem("p-51-b", 51),
  problem("p-52-a", 52),
  problem("p-53-a", 53),
  problem("p-54-a", 54),
];

describe("computeFallbackRecommendations", () => {
  it("recommends one problem per type in rotation order for a user with no history", async () => {
    const { client } = makeClient({ problems: FOUR_TYPE_PROBLEMS });

    const result = await computeFallbackRecommendations(client, "user-1", null);

    expect(result.items).toHaveLength(4);
    expect(result.items.map((item) => item.questionNo)).toEqual([
      51, 52, 53, 54,
    ]);
    expect(result.items.map((item) => item.rank)).toEqual([1, 2, 3, 4]);
    expect(result.items[0].reasonCode).toBe("TYPE_ROTATION_NEXT");
    expect(
      result.items.slice(1).map((item) => item.reasonCode),
    ).toEqual([
      "UNATTEMPTED_AVAILABLE",
      "UNATTEMPTED_AVAILABLE",
      "UNATTEMPTED_AVAILABLE",
    ]);
    expect(result.items.every((item) => item.itemId === null)).toBe(true);
    expect(result.items.every((item) => item.weaknessTags.length === 0)).toBe(
      true,
    );
    expect(result.summaryCode).toBe("rotation");
    expect(result.availableTypes).toEqual([51, 52, 53, 54]);
  });

  it("never recommends a writing problem the user already submitted or drafted", async () => {
    const { client } = makeClient({
      problems: [
        ...FOUR_TYPE_PROBLEMS,
        problem("p-52-b", 52),
        problem("p-draft-superseded", 53),
      ],
      submissions: [{ problem_id: "p-51-a", question_no: 51 }],
      drafts: [
        { problem_id: "p-52-a", question_no: 52 },
        {
          problem_id: "p-draft-superseded",
          question_no: 53,
          autosave_status: "superseded",
        },
      ],
    });

    const result = await computeFallbackRecommendations(client, "user-1", null);

    const ids = result.items.map((item) => item.problemId);
    expect(ids).not.toContain("p-51-a");
    expect(ids).not.toContain("p-52-a");
    expect(ids).toContain("p-51-b");
    expect(ids).toContain("p-52-b");
    expect(result.summaryCode).toBe("history");
  });

  it("puts the rotation-next type first and marks the recent type as continuation", async () => {
    const { client } = makeClient({
      problems: FOUR_TYPE_PROBLEMS,
      submissions: [
        {
          problem_id: "p-old",
          question_no: 51,
          submitted_at: "2026-07-01T00:00:00.000Z",
        },
      ],
    });

    const result = await computeFallbackRecommendations(client, "user-1", null);

    // Latest writing activity was 51 → rotation starts at 52; 51 comes back last.
    expect(result.items.map((item) => item.questionNo)).toEqual([
      52, 53, 54, 51,
    ]);
    expect(result.items[0].reasonCode).toBe("TYPE_ROTATION_NEXT");
    const q51 = result.items.find((item) => item.questionNo === 51);
    expect(q51?.reasonCode).toBe("RECENT_TYPE_CONTINUATION");
  });

  it("boosts problems whose tags overlap measured weak dimensions and reports only real overlaps", async () => {
    const { client } = makeClient({
      problems: [
        problem("p-51-plain", 51),
        problem("p-51-grammar", 51, { tags: ["grammar", "extra"] }),
      ],
      // Latest writing activity is type 52, so type-51 candidates earn neither the
      // rotation-next (53) nor the continuation (52) bonus — the weak-tag
      // overlap is the only differentiator and must own the reason code.
      submissions: [{ problem_id: "p-done-52", question_no: 52 }],
      dimensionScores: [
        ...dimensionRows("grammar", 40),
        ...dimensionRows("vocab", 90),
      ],
    });

    const result = await computeFallbackRecommendations(client, "user-1", 51);

    expect(result.items[0].problemId).toBe("p-51-grammar");
    expect(result.items[0].reasonCode).toBe("WEAK_AREA_TAG_MATCH");
    // vocab is also a measured weak dimension but does NOT overlap this
    // problem's tags — it must not be padded in.
    expect(result.items[0].weaknessTags).toEqual(["grammar"]);
    expect(result.items[1].weaknessTags).toEqual([]);
    expect(result.summaryCode).toBe("history");
  });

  it("returns only the requested type when a type filter is set", async () => {
    const { client } = makeClient({ problems: FOUR_TYPE_PROBLEMS });

    const result = await computeFallbackRecommendations(client, "user-1", 52);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].problemId).toBe("p-52-a");
    expect(result.availableTypes).toEqual([52]);
  });

  it("uses the latest writing draft or submission as the rotation anchor", async () => {
    const { client } = makeClient({
      problems: FOUR_TYPE_PROBLEMS,
      submissions: [
        {
          problem_id: "p-old",
          question_no: 51,
          submitted_at: "2026-07-01T00:00:00.000Z",
        },
      ],
      drafts: [
        {
          problem_id: "p-draft",
          question_no: 53,
          updated_at: "2026-07-02T00:00:00.000Z",
        },
      ],
    });

    const result = await computeFallbackRecommendations(client, "user-1", null);

    expect(result.items.map((item) => item.questionNo)).toEqual([
      54, 51, 52, 53,
    ]);
  });

  it("marks goal-only scoring as a personal-signal summary", async () => {
    const { client } = makeClient({
      problems: [
        problem("p-easy", 51, { topik_level: 1, difficulty: 1 }),
        problem("p-goal", 51, { topik_level: 2, difficulty: 4 }),
      ],
      goal: { topik_level: "TOPIK_II", target_grade: 4 },
    });

    const result = await computeFallbackRecommendations(client, "user-1", 51);

    expect(result.items[0].problemId).toBe("p-goal");
    expect(result.summaryCode).toBe("history");
  });

  it("fails closed to an empty result when the visibility RPC hides everything", async () => {
    const { client } = makeClient({
      problems: FOUR_TYPE_PROBLEMS,
      visibleProblemIds: [],
    });

    const result = await computeFallbackRecommendations(client, "user-1", null);

    expect(result.items).toEqual([]);
    expect(result.availableTypes).toEqual([]);
    expect(result.summaryCode).toBeNull();
  });

  it("excludes seed fixture problems by tag prefix and materials marker", async () => {
    const { client } = makeClient({
      problems: [
        problem("p-seed-tag", 51, { tags: ["seed:wireframe"] }),
        problem("p-seed-materials", 51, {
          materials: { seed_source: "wireframe_problem_fixtures" },
        }),
        problem("p-real", 51),
      ],
    });

    const result = await computeFallbackRecommendations(client, "user-1", 51);

    expect(result.items.map((item) => item.problemId)).toEqual(["p-real"]);
  });

  it("retries without the lifecycle filter when the column does not exist", async () => {
    const { client, calls } = makeClient({
      problems: [problem("p-51-a", 51)],
      lifecycleColumnMissing: true,
    });

    const result = await computeFallbackRecommendations(client, "user-1", 51);

    expect(result.items.map((item) => item.problemId)).toEqual(["p-51-a"]);
    expect(calls.lifecycleFilteredQueries).toBeGreaterThan(0);
  });

  it("degrades weak-dimension and goal signal failures to neutral instead of throwing", async () => {
    const { client } = makeClient({
      problems: FOUR_TYPE_PROBLEMS,
      dimensionError: { message: "boom" },
      goalError: { message: "boom" },
    });

    const result = await computeFallbackRecommendations(client, "user-1", null);

    expect(result.items).toHaveLength(4);
    expect(result.summaryCode).toBe("rotation");
    expect(result.items.every((item) => item.weaknessTags.length === 0)).toBe(
      true,
    );
  });

  it("is deterministic — identical inputs produce identical output", async () => {
    const opts: ClientOpts = {
      problems: [
        problem("p-51-b", 51, { title: "같은 제목", difficulty: 3 }),
        problem("p-51-a", 51, { title: "같은 제목", difficulty: 3 }),
        problem("p-52-a", 52),
      ],
      submissions: [{ problem_id: "p-old", question_no: 54 }],
    };

    const first = await computeFallbackRecommendations(
      makeClient(opts).client,
      "user-1",
      null,
    );
    const second = await computeFallbackRecommendations(
      makeClient(opts).client,
      "user-1",
      null,
    );

    expect(second).toEqual(first);
    // Identical score/difficulty/title → id ascending decides.
    const q51 = first.items.filter((item) => item.questionNo === 51);
    expect(q51[0]?.problemId).toBe("p-51-a");
  });
});

describe("rankFallbackCandidates", () => {
  const NO_SIGNALS: FallbackSignals = {
    attemptedIds: new Set<string>(),
    latestQuestionNo: null,
    weakDimensions: [],
    goal: null,
  };

  function candidate(
    id: string,
    questionNo: QuestionNo,
    overrides: Partial<FallbackCandidate> = {},
  ): FallbackCandidate {
    return {
      id,
      title: `Candidate ${id}`,
      questionNo,
      topikLevel: 2,
      difficulty: 3,
      tags: [],
      ...overrides,
    };
  }

  it("prefers goal-adjacent difficulty and penalizes a difficulty jump", () => {
    const signals: FallbackSignals = {
      ...NO_SIGNALS,
      // Latest type 53 → rotation-next is 54 and continuation is 53, so the
      // type-51 candidates below carry pure goal scoring.
      latestQuestionNo: 53,
      goal: { topik_level: "TOPIK_II", target_grade: 4 }, // target difficulty 4
    };
    const ranked = rankFallbackCandidates(
      [
        candidate("c-far", 51, { difficulty: 1 }),
        candidate("c-near", 51, { difficulty: 4 }),
        candidate("c-jump", 51, { difficulty: 6, topikLevel: null }),
      ],
      signals,
      51,
    );

    expect(ranked.map((entry) => entry.candidate.id)).toEqual([
      "c-near",
      "c-far",
      "c-jump",
    ]);
    expect(ranked[0].reasonCode).toBe("GOAL_DIFFICULTY_MATCH");
    // c-jump: rotation +20 and level bonus don't apply per-fixture; the jump
    // penalty must land it below the neutral candidate.
    expect(ranked[2].score).toBeLessThan(ranked[1].score);
  });

  it("breaks exact ties by difficulty, then ko-locale title, then id", () => {
    const ranked = rankFallbackCandidates(
      [
        candidate("c-b", 51, { title: "나 제목", difficulty: 2 }),
        candidate("c-a", 51, { title: "가 제목", difficulty: 2 }),
        candidate("c-easy", 51, { difficulty: 1, title: "다 제목" }),
      ],
      NO_SIGNALS,
      51,
    );

    expect(ranked.map((entry) => entry.candidate.id)).toEqual([
      "c-easy",
      "c-a",
      "c-b",
    ]);
  });
});
