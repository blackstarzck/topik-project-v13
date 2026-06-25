import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getNextProblem,
  getNextProblemBundle,
} from "../../../src/lib/practice/next";

type RecItem = {
  id?: string;
  problem_id: string;
  rank: number;
  reason: string | null;
  recommendation_runs: { expires_at: string | null } | null;
  problems: {
    id: string;
    title: string;
    domain: string;
    question_no: number | null;
    publish_status: string;
  } | null;
};

type AttemptRow = {
  problem_id: string;
  started_at: string;
  problems: { id: string; question_no: number | null } | null;
};

type ProblemRow = {
  id: string;
  title: string;
  domain: string;
  question_no: number | null;
  difficulty?: number | null;
};

/**
 * Stub Supabase client. Tracks which table received the "problems" query so
 * we can return a different candidate set per fallback tier (tier-2 filters
 * by question_no, tier-3 does not).
 */
function makeClient(opts: {
  recItems?: RecItem[];
  recError?: { message: string } | null;
  attempts?: AttemptRow[];
  attemptError?: { message: string } | null;
  problemsByQuestionNo?: Record<number, ProblemRow[]>;
  problemsAny?: ProblemRow[];
  problemsError?: { message: string } | null;
  submissionCount?: number;
  feedbacks?: { score_total: number | null }[];
  dimensionScores?: { dimension: string; score: number | null }[];
  profile?: { plan_label: string | null } | null;
}) {
  return {
    from(table: string) {
      if (table === "recommendation_items") {
        const chain = {
          eq: () => chain,
          or: () => chain,
          order: () => chain,
          limit: () =>
            Promise.resolve({
              data: opts.recItems ?? [],
              error: opts.recError ?? null,
            }),
        };
        return { select: () => chain };
      }
      if (table === "problem_attempts") {
        const chain = {
          eq: () => chain,
          order: () =>
            Promise.resolve({
              data: opts.attempts ?? [],
              error: opts.attemptError ?? null,
            }),
        };
        return { select: () => chain };
      }
      if (table === "problems") {
        let questionNoFilter: number | null = null;
        const chain = {
          eq: (col: string, value: unknown) => {
            if (col === "question_no" && typeof value === "number") {
              questionNoFilter = value;
            }
            return chain;
          },
          order: () => chain,
          limit: () => {
            const set =
              questionNoFilter != null
                ? (opts.problemsByQuestionNo?.[questionNoFilter] ?? [])
                : (opts.problemsAny ?? []);
            return Promise.resolve({
              data: set,
              error: opts.problemsError ?? null,
            });
          },
        };
        return { select: () => chain };
      }
      if (table === "writing_submissions") {
        const chain = {
          eq: () => chain,
          gte: () =>
            Promise.resolve({
              data: [],
              count: opts.submissionCount ?? 0,
              error: null,
            }),
        };
        return { select: () => chain };
      }
      if (table === "writing_feedback") {
        const chain = {
          eq: () => chain,
          not: () => chain,
          order: () => chain,
          limit: () =>
            Promise.resolve({
              data: opts.feedbacks ?? [],
              error: null,
            }),
        };
        return { select: () => chain };
      }
      if (table === "feedback_dimension_scores") {
        const chain = {
          eq: () => chain,
          not: () =>
            Promise.resolve({
              data: opts.dimensionScores ?? [],
              error: null,
            }),
        };
        return { select: () => chain };
      }
      if (table === "profiles") {
        const chain = {
          eq: () => chain,
          maybeSingle: () =>
            Promise.resolve({
              data: opts.profile ?? { plan_label: "premium" },
              error: null,
            }),
        };
        return { select: () => chain };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getNextProblem", () => {
  it("tier 1: returns the active recommendation_items hit when available", async () => {
    const recItems: RecItem[] = [
      {
        problem_id: "p-rec",
        rank: 1,
        reason: "weak grammar",
        recommendation_runs: { expires_at: null },
        problems: {
          id: "p-rec",
          title: "Rec problem",
          domain: "writing",
          question_no: 53,
          publish_status: "published",
        },
      },
    ];
    const create = async () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeClient({ recItems }) as any;
    const out = await getNextProblem("user-1", create);
    expect(out).toEqual({
      problemId: "p-rec",
      title: "Rec problem",
      domain: "writing",
      questionNo: 53,
      source: "recommendation",
      reason: "weak grammar",
    });
  });

  it("tier 1: skips an unpublished recommendation and uses the next published one", async () => {
    const recItems: RecItem[] = [
      {
        id: "rec-draft",
        problem_id: "p-draft",
        rank: 1,
        reason: "draft should not show",
        recommendation_runs: { expires_at: null },
        problems: {
          id: "p-draft",
          title: "Draft problem",
          domain: "writing",
          question_no: 53,
          publish_status: "draft",
        },
      },
      {
        id: "rec-published",
        problem_id: "p-published",
        rank: 2,
        reason: "published backup",
        recommendation_runs: { expires_at: null },
        problems: {
          id: "p-published",
          title: "Published backup",
          domain: "writing",
          question_no: 52,
          publish_status: "published",
        },
      },
    ];
    const create = async () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeClient({ recItems, attempts: [], problemsAny: [] }) as any;

    const out = await getNextProblem("user-1", create);
    expect(out?.problemId).toBe("p-published");
    expect(out?.source).toBe("recommendation");
    expect(out?.reason).toBe("published backup");
  });

  it("tier 2: falls back to same-question_no when recommendations are empty", async () => {
    const attempts: AttemptRow[] = [
      {
        problem_id: "p-already-tried",
        started_at: "2026-05-20T00:00:00Z",
        problems: { id: "p-already-tried", question_no: 53 },
      },
    ];
    const candidatesByQuestion = {
      53: [
        // The user already tried p-already-tried; the helper must skip it.
        {
          id: "p-already-tried",
          title: "Tried already",
          domain: "writing",
          question_no: 53,
        },
        {
          id: "p-next-53",
          title: "Next 53",
          domain: "writing",
          question_no: 53,
        },
      ],
    };
    const create = async () =>
      makeClient({
        recItems: [],
        attempts,
        problemsByQuestionNo: candidatesByQuestion,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any;

    const out = await getNextProblem("user-1", create);
    expect(out?.problemId).toBe("p-next-53");
    expect(out?.source).toBe("same_question_no");
    expect(out?.questionNo).toBe(53);
  });

  it("tier 3: falls back to a random un-attempted published problem", async () => {
    // No active recommendations, and the user has never attempted anything
    // → so there's no latest question_no signal for tier 2 (tier 2 is
    // skipped entirely and tier 3 picks from the full set).
    const create = async () =>
      makeClient({
        recItems: [],
        attempts: [],
        problemsAny: [
          {
            id: "p-random",
            title: "Random",
            domain: "writing",
            question_no: 51,
          },
        ],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any;

    const out = await getNextProblem("user-1", create);
    expect(out?.problemId).toBe("p-random");
    expect(out?.source).toBe("random");
  });

  it("tier 3: picks the first primary slot from the 51-54 writing set", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const create = async () =>
      makeClient({
        recItems: [],
        attempts: [],
        problemsAny: [
          {
            id: "p-53",
            title: "Long form first in DB",
            domain: "writing",
            question_no: 53,
          },
          {
            id: "p-51",
            title: "Short answer first recommendation",
            domain: "writing",
            question_no: 51,
          },
        ],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any;

    const out = await getNextProblem("user-1", create);
    expect(out?.problemId).toBe("p-51");
    expect(out?.source).toBe("random");
  });

  it("tier 3 also runs when tier 2 finds no fresh question_no match", async () => {
    // Latest attempt is question 51 but every q51 problem was already tried.
    const attempts: AttemptRow[] = [
      {
        problem_id: "p-51-old",
        started_at: "2026-05-20T00:00:00Z",
        problems: { id: "p-51-old", question_no: 51 },
      },
    ];
    const create = async () =>
      makeClient({
        recItems: [],
        attempts,
        problemsByQuestionNo: {
          51: [
            {
              id: "p-51-old",
              title: "Old",
              domain: "writing",
              question_no: 51,
            },
          ],
        },
        problemsAny: [
          {
            id: "p-fresh",
            title: "Fresh",
            domain: "writing",
            question_no: 53,
          },
        ],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any;

    const out = await getNextProblem("user-1", create);
    expect(out?.problemId).toBe("p-fresh");
    expect(out?.source).toBe("random");
  });

  it("tier 3: continues the 51-52-53-54 rotation when same-question_no has no fresh problem", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attempts: AttemptRow[] = [
      {
        problem_id: "p-51-old",
        started_at: "2026-05-20T00:00:00Z",
        problems: { id: "p-51-old", question_no: 51 },
      },
    ];
    const create = async () =>
      makeClient({
        recItems: [],
        attempts,
        problemsByQuestionNo: {
          51: [
            {
              id: "p-51-old",
              title: "Old",
              domain: "writing",
              question_no: 51,
            },
          ],
        },
        problemsAny: [
          {
            id: "p-54",
            title: "Essay first in DB",
            domain: "writing",
            question_no: 54,
          },
          {
            id: "p-52",
            title: "Next rotation problem",
            domain: "writing",
            question_no: 52,
          },
        ],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any;

    const out = await getNextProblem("user-1", create);
    expect(out?.problemId).toBe("p-52");
    expect(out?.source).toBe("random");
  });

  it("tier 4: returns null when there is no problem to surface at all", async () => {
    const create = async () =>
      makeClient({
        recItems: [],
        attempts: [],
        problemsAny: [],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any;
    const out = await getNextProblem("user-1", create);
    expect(out).toBeNull();
  });
});

describe("getNextProblemBundle", () => {
  it("returns a published-problem fallback bundle for a new user when recommendation_items is empty", async () => {
    const create = async () =>
      makeClient({
        recItems: [],
        attempts: [],
        problemsAny: [
          {
            id: "p-51",
            title: "Primary 51",
            domain: "writing",
            question_no: 51,
            difficulty: 3,
          },
          {
            id: "p-52",
            title: "Alternative 52",
            domain: "writing",
            question_no: 52,
            difficulty: 3,
          },
          {
            id: "p-53",
            title: "Alternative 53",
            domain: "writing",
            question_no: 53,
            difficulty: 3,
          },
          {
            id: "p-54",
            title: "Alternative 54",
            domain: "writing",
            question_no: 54,
            difficulty: 3,
          },
        ],
        profile: { plan_label: "premium" },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any;

    const bundle = await getNextProblemBundle("user-1", create);

    expect(bundle.primary?.problemId).toBe("p-51");
    expect(bundle.primary?.source).toBe("random");
    expect(bundle.primaryTier).toBe(3);
    expect(bundle.alternatives.map((alt) => alt.id)).toEqual([
      "p-52",
      "p-53",
      "p-54",
    ]);
    expect([
      bundle.primary?.questionNo,
      ...bundle.alternatives.map((alt) => alt.questionNo),
    ]).toEqual([51, 52, 53, 54]);
  });
});
