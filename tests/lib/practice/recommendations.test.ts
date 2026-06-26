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

function makeClient(opts: {
  recItems?: RecItem[];
  visibleProblemIds?: string[];
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
        }) as never,
    );

    expect(bundle.items).toEqual([]);
    expect(bundle.run).toBeNull();
  });
});

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
