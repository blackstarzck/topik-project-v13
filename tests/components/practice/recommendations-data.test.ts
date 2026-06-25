// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  fetchRecommendationBundle,
  RecommendationRequestTimeoutError,
} from "../../../src/components/practice/recommendations-data";

describe("fetchRecommendationBundle", () => {
  it("rejects when the recommendation request stays pending", async () => {
    const pendingQuery = {
      select: vi.fn(() => pendingQuery),
      or: vi.fn(() => pendingQuery),
      order: vi.fn(() => pendingQuery),
      limit: vi.fn(() => pendingQuery),
      maybeSingle: vi.fn(() => new Promise(() => undefined)),
    };
    const createClient = vi.fn(() => ({
      from: vi.fn(() => pendingQuery),
    }));

    await expect(
      fetchRecommendationBundle(null, createClient as never, 5),
    ).rejects.toBeInstanceOf(RecommendationRequestTimeoutError);
  });

  it("does not surface items from expired recommendation runs", async () => {
    const expiredItem = {
      id: "rec-expired",
      problem_id: "problem-expired",
      rank: 1,
      reason: "expired recommendation",
      estimated_minutes: 12,
      weakness_tags: ["grammar"],
      problems: {
        title: "Expired recommendation problem",
        question_no: 51,
      },
    };
    const runQuery = {
      select: vi.fn(() => runQuery),
      or: vi.fn(() => runQuery),
      order: vi.fn(() => runQuery),
      limit: vi.fn(() => runQuery),
      maybeSingle: vi.fn(() =>
        Promise.resolve({
          data: {
            id: "run-expired",
            source_type: "weakness",
            reason_summary: "expired run",
            created_at: "2026-06-01T00:00:00.000Z",
            expires_at: "2026-06-01T00:00:00.000Z",
          },
          error: null,
        }),
      ),
    };
    let filteredExpiredRuns = false;
    const itemQuery = {
      select: vi.fn(() => itemQuery),
      eq: vi.fn(() => itemQuery),
      or: vi.fn(() => {
        filteredExpiredRuns = true;
        return itemQuery;
      }),
      order: vi.fn(() => itemQuery),
      limit: vi.fn(() =>
        Promise.resolve({
          data: filteredExpiredRuns ? [] : [expiredItem],
          error: null,
        }),
      ),
    };
    const createClient = vi.fn(() => ({
      from: vi.fn((table: string) =>
        table === "recommendation_runs" ? runQuery : itemQuery,
      ),
    }));

    const bundle = await fetchRecommendationBundle(
      null,
      createClient as never,
      50,
    );

    expect(bundle.items).toEqual([]);
  });
});
