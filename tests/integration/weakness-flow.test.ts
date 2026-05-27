import { describe, it, expect, vi } from "vitest";

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
    from: (table: string) => {
      if (table === "feedback_dimension_scores") {
        return {
          select: () => ({
            eq: () =>
              Promise.resolve({ data: opts.scores ?? [], error: null }),
          }),
        };
      }
      if (table === "recommendation_items") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                or: () => ({
                  order: () => ({
                    limit: () =>
                      Promise.resolve({
                        data: opts.recItems ?? [],
                        error: null,
                      }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "problems") {
        return {
          select: () => ({
            eq: () => ({
              overlaps: (col: string, values: unknown[]) => {
                overlapsCalls.push({ col, values });
                const result = Promise.resolve({
                  data: opts.fallbackProblems ?? [],
                  error: null,
                });
                return {
                  order: () => ({
                    limit: () => result,
                  }),
                  limit: () => result,
                };
              },
            }),
          }),
        };
      }
      return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
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
    const dims = await getWeakDimensions("user-1", 5, async () => client as never);
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
    const dims = await getWeakDimensions("user-1", 5, async () => client as never);
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
