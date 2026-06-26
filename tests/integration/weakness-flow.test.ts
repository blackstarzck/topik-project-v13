import { describe, expect, it } from "vitest";

// Phase 6 integration: weakness-flow
// - getWeakDimensions returns empty when fewer than threshold scored entries
// - returns bottom-2 by avg score when threshold is met
// - getWeaknessRecommendations falls back to tag overlap when
//   recommendation_items is empty

import {
  getWeakDimensions,
  getWeaknessRecommendations,
} from "@/lib/practice/weakness";

type ScoreRow = { dimension: string; score: number; score_max: number };

function makeClient(opts: {
  scores?: ScoreRow[];
  recItems?: unknown[];
  fallbackProblems?: unknown[];
}) {
  const overlapsCalls: Array<{ col: string; values: unknown[] }> = [];
  return {
    overlapsCalls,
    rpc: (name: string, args: unknown) => {
      if (name === "filter_visible_writing_problem_ids") {
        const problemIds =
          typeof args === "object" && args !== null && "p_problem_ids" in args
            ? ((args as { p_problem_ids?: string[] }).p_problem_ids ?? [])
            : [];
        return Promise.resolve({
          data: problemIds.map((problemId) => ({ problem_id: problemId })),
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    },
    from: (table: string) => {
      if (table === "feedback_dimension_scores") {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: opts.scores ?? [], error: null }),
          }),
        };
      }
      if (table === "recommendation_items") {
        let start = 0;
        let end: number | null = null;
        const rows = () =>
          end == null
            ? (opts.recItems ?? [])
            : (opts.recItems ?? []).slice(start, end + 1);
        const result = () =>
          Promise.resolve({
            data: rows(),
            error: null,
          });
        const chain = {
          eq: () => chain,
          or: () => chain,
          order: () => chain,
          limit: () => result(),
          range: (from: number, to: number) => {
            start = from;
            end = to;
            return result();
          },
        };
        return {
          select: () => chain,
        };
      }
      if (table === "problems") {
        let start = 0;
        let end: number | null = null;
        const rows = () =>
          end == null
            ? (opts.fallbackProblems ?? [])
            : (opts.fallbackProblems ?? []).slice(start, end + 1);
        const result = () =>
          Promise.resolve({
            data: rows(),
            error: null,
          });
        const overlapChain = {
          eq: () => overlapChain,
          overlaps: (col: string, values: unknown[]) => {
            overlapsCalls.push({ col, values });
            return overlapChain;
          },
          order: () => overlapChain,
          limit: () => result(),
          range: (from: number, to: number) => {
            start = from;
            end = to;
            return result();
          },
        };
        return {
          select: () => overlapChain,
        };
      }
      return {
        select: () => ({
          eq: () => Promise.resolve({ data: [], error: null }),
        }),
      };
    },
  };
}

describe("weakness-flow — gate threshold", () => {
  it("returns empty when fewer than 5 entries per dimension", async () => {
    const client = makeClient({
      scores: [
        { dimension: "grammar", score: 60, score_max: 100 },
        { dimension: "grammar", score: 70, score_max: 100 },
      ],
    });
    const dims = await getWeakDimensions(
      "user-1",
      5,
      async () => client as never,
    );
    expect(dims).toEqual([]);
  });

  it("returns bottom-2 by avg score when threshold met", async () => {
    const make = (dim: string, score: number): ScoreRow => ({
      dimension: dim,
      score,
      score_max: 100,
    });
    const scores: ScoreRow[] = [];
    // 5 entries each across 3 dimensions, with grammar lowest avg
    for (let i = 0; i < 5; i += 1) {
      scores.push(make("grammar", 40 + i));
      scores.push(make("vocab", 80 + i));
      scores.push(make("structure", 60 + i));
    }
    const client = makeClient({ scores });
    const dims = await getWeakDimensions(
      "user-1",
      5,
      async () => client as never,
    );
    expect(dims).toHaveLength(2);
    expect(dims[0].dimension).toBe("grammar"); // lowest avg
  });
});

describe("weakness-flow — recommendation fallback", () => {
  it("falls back to problems.tags overlap when recommendation_items is empty", async () => {
    const make = (dim: string, score: number): ScoreRow => ({
      dimension: dim,
      score,
      score_max: 100,
    });
    const scores: ScoreRow[] = [];
    for (let i = 0; i < 5; i += 1) {
      scores.push(make("grammar", 40 + i));
      scores.push(make("vocab", 90 + i));
      scores.push(make("structure", 60 + i));
    }
    const client = makeClient({
      scores,
      recItems: [],
      fallbackProblems: [
        {
          id: "p-1",
          title: "문법 보강",
          domain: "writing",
          question_no: 51,
          tags: ["grammar"],
        },
      ],
    });
    const recs = await getWeaknessRecommendations(
      "user-1",
      async () => client as never,
    );
    expect(client.overlapsCalls.length).toBeGreaterThan(0);
    expect(client.overlapsCalls[0].col).toBe("tags");
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0].source).toBe("tag_fallback");
  });
});
