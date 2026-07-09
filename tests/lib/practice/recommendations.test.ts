import { describe, expect, it } from "vitest";
import { queryRecommendationBundleForUser } from "../../../src/lib/practice/recommendations";

type RecItem = {
  id: string;
  run_id: string;
  problem_id: string;
  rank: number;
  reason: string | null;
  estimated_minutes: number | null;
  weakness_tags: string[] | null;
  problems: {
    id: string;
    title: string;
    question_no: number | null;
    publish_status: string;
  } | null;
};

type FallbackProblemRow = {
  id: string;
  title: string;
  question_no: number;
  topik_level: number | null;
  difficulty: number | null;
  tags: string[] | null;
  materials: unknown;
};

function makeClient(opts: {
  recItems?: RecItem[];
  visibleProblemIds?: string[];
  /**
   * Candidate pool for the computed (Tier-2) path. When ABSENT, touching
   * writing history / `problems` throws — which is exactly how the
   * stored-precedence tests prove Tier-2 never runs.
   */
  fallbackProblems?: FallbackProblemRow[];
}) {
  return {
    rpc(name: string, args: { p_problem_ids?: string[] }) {
      if (name !== "filter_visible_writing_problem_ids") {
        throw new Error(`unexpected rpc ${name}`);
      }
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
      if (opts.fallbackProblems) {
        if (table === "writing_submissions") {
          const chain = {
            eq: () => chain,
            order: () => Promise.resolve({ data: [], error: null }),
          };
          return { select: () => chain };
        }
        if (table === "writing_drafts") {
          const chain = {
            eq: () => chain,
            neq: () => chain,
            order: () => Promise.resolve({ data: [], error: null }),
          };
          return { select: () => chain };
        }
        if (table === "feedback_dimension_scores") {
          return {
            select: () => ({
              eq: () => Promise.resolve({ data: [], error: null }),
            }),
          };
        }
        if (table === "learning_goals") {
          const chain = {
            eq: () => chain,
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          };
          return { select: () => chain };
        }
        if (table === "problems") {
          let questionNoFilter: number | null = null;
          const chain = {
            eq: (column: string, value: unknown) => {
              if (column === "question_no" && typeof value === "number") {
                questionNoFilter = value;
              }
              return chain;
            },
            order: () => chain,
            range: (from: number, to: number) => {
              const rows = (opts.fallbackProblems ?? []).filter(
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
      }
      if (table === "recommendation_runs") {
        const chain = {
          eq: () => chain,
          or: () => chain,
          order: () => chain,
          limit: () => chain,
          maybeSingle: () =>
            Promise.resolve({
              data: {
                id: "run-1",
                source_type: "weakness",
                reason_summary: "recent weakness",
                created_at: "2026-06-26T00:00:00.000Z",
              },
              error: null,
            }),
        };
        return { select: () => chain };
      }
      if (table === "recommendation_items") {
        let questionNoFilter: number | null = null;
        let start = 0;
        let end: number | null = null;
        const resolveRows = () => {
          const rows = (opts.recItems ?? []).filter(
            (item) =>
              questionNoFilter == null ||
              item.problems?.question_no === questionNoFilter,
          );
          return end == null ? rows : rows.slice(start, end + 1);
        };
        const chain = {
          eq: (column: string, value: unknown) => {
            if (
              column === "problems.question_no" &&
              typeof value === "number"
            ) {
              questionNoFilter = value;
            }
            return chain;
          },
          or: () => chain,
          order: () => chain,
          limit: () => Promise.resolve({ data: resolveRows(), error: null }),
          range: (from: number, to: number) => {
            start = from;
            end = to;
            return Promise.resolve({ data: resolveRows(), error: null });
          },
        };
        return { select: () => chain };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

describe("queryRecommendationBundleForUser", () => {
  it("filters hidden recommendation items through institution visibility", async () => {
    const bundle = await queryRecommendationBundleForUser(
      "user-1",
      null,
      async () =>
        makeClient({
          recItems: [
            makeItem("i-hidden", "p-hidden", 1, 53),
            makeItem("i-visible", "p-visible", 2, 52),
          ],
          visibleProblemIds: ["p-visible"],
        }) as never,
    );

    expect(bundle.items.map((item) => item.problemId)).toEqual(["p-visible"]);
    expect(bundle.availableTypes).toEqual([52]);
    expect(bundle.run?.reasonSummary).toBeNull();
    // Stored items present → Tier-2 must not run. makeClient throws on any
    // writing history/problems access when fallbackProblems is absent, so
    // reaching this assertion IS the proof.
    expect(bundle.source).toBe("stored");
  });

  it("applies the selected question number filter before returning items", async () => {
    const bundle = await queryRecommendationBundleForUser(
      "user-1",
      51,
      async () =>
        makeClient({
          recItems: [
            makeItem("i-51", "p-51", 1, 51),
            makeItem("i-52", "p-52", 2, 52),
          ],
        }) as never,
    );

    expect(bundle.items.map((item) => item.problemId)).toEqual(["p-51"]);
    expect(bundle.availableTypes).toEqual([51]);
  });

  it("scans beyond the first hidden recommendation item page", async () => {
    const hiddenItems = Array.from({ length: 8 }, (_, index) =>
      makeItem(`i-hidden-${index}`, `p-hidden-${index}`, index + 1, 53),
    );

    const bundle = await queryRecommendationBundleForUser(
      "user-1",
      null,
      async () =>
        makeClient({
          recItems: [...hiddenItems, makeItem("i-visible", "p-visible", 9, 54)],
          visibleProblemIds: ["p-visible"],
        }) as never,
    );

    expect(bundle.items.map((item) => item.problemId)).toEqual(["p-visible"]);
    expect(bundle.availableTypes).toEqual([54]);
  });

  it("does not expose a run summary when all items for that run are hidden", async () => {
    const bundle = await queryRecommendationBundleForUser(
      "user-1",
      null,
      async () =>
        makeClient({
          recItems: [makeItem("i-hidden", "p-hidden", 1, 53)],
          visibleProblemIds: [],
          // Tier-2 runs but the visibility RPC hides everything → honest empty.
          fallbackProblems: [makeFallbackProblem("p-candidate", 51)],
        }) as never,
    );

    expect(bundle.items).toEqual([]);
    expect(bundle.run).toBeNull();
    expect(bundle.source).toBe("computed");
  });

  it("computes a rule-based bundle when the user has zero stored items", async () => {
    const bundle = await queryRecommendationBundleForUser(
      "user-1",
      null,
      async () =>
        makeClient({
          recItems: [],
          fallbackProblems: [
            makeFallbackProblem("p-51", 51),
            makeFallbackProblem("p-52", 52),
          ],
        }) as never,
    );

    expect(bundle.source).toBe("computed");
    expect(bundle.run).toBeNull();
    expect(bundle.items.map((item) => item.problemId)).toEqual([
      "p-51",
      "p-52",
    ]);
    expect(bundle.items.every((item) => item.itemId === null)).toBe(true);
    expect(bundle.items.map((item) => item.rank)).toEqual([1, 2]);
    expect(bundle.summaryCode).toBe("rotation");
    expect(bundle.availableTypes).toEqual([51, 52]);
  });

  it("falls back to computed items when every stored item is hidden but candidates exist", async () => {
    const bundle = await queryRecommendationBundleForUser(
      "user-1",
      null,
      async () =>
        makeClient({
          recItems: [makeItem("i-hidden", "p-hidden", 1, 53)],
          visibleProblemIds: ["p-51"],
          fallbackProblems: [makeFallbackProblem("p-51", 51)],
        }) as never,
    );

    expect(bundle.source).toBe("computed");
    expect(bundle.items.map((item) => item.problemId)).toEqual(["p-51"]);
  });

  it("computes for a type whose stored items don't cover the requested filter", async () => {
    const bundle = await queryRecommendationBundleForUser(
      "user-1",
      51,
      async () =>
        makeClient({
          // Stored recommendation exists only for type 52 — a 51 request must
          // resolve per-query: zero stored 51 items → computed 51 items.
          recItems: [makeItem("i-52", "p-52", 1, 52)],
          fallbackProblems: [
            makeFallbackProblem("p-51-fresh", 51),
            makeFallbackProblem("p-52-fresh", 52),
          ],
        }) as never,
    );

    expect(bundle.source).toBe("computed");
    expect(bundle.items.map((item) => item.problemId)).toEqual(["p-51-fresh"]);
    expect(bundle.availableTypes).toEqual([51]);
  });
});

function makeFallbackProblem(
  id: string,
  questionNo: number,
): FallbackProblemRow {
  return {
    id,
    title: `Fallback ${id}`,
    question_no: questionNo,
    topik_level: 2,
    difficulty: 3,
    tags: [],
    materials: null,
  };
}

function makeItem(
  id: string,
  problemId: string,
  rank: number,
  questionNo: number,
): RecItem {
  return {
    id,
    run_id: "run-1",
    problem_id: problemId,
    rank,
    reason: null,
    estimated_minutes: null,
    weakness_tags: null,
    problems: {
      id: problemId,
      title: `Problem ${problemId}`,
      question_no: questionNo,
      publish_status: "published",
    },
  };
}
