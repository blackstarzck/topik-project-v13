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
});
