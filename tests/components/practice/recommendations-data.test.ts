// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchRecommendationBundle,
  RecommendationRequestTimeoutError,
} from "../../../src/components/practice/recommendations-data";

describe("fetchRecommendationBundle", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("loads the bundle through the server API route", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        run: null,
        items: [],
        availableTypes: [51, 52],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const bundle = await fetchRecommendationBundle(51, 50);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/practice/recommendations?type=51",
      { credentials: "same-origin" },
    );
    expect([...bundle.availableTypes]).toEqual([51, 52]);
  });

  it("rejects when the recommendation request stays pending", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => undefined)),
    );

    await expect(fetchRecommendationBundle(null, 5)).rejects.toBeInstanceOf(
      RecommendationRequestTimeoutError,
    );
  });

  it("rejects when the server API route fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
      })),
    );

    await expect(fetchRecommendationBundle(null, 50)).rejects.toThrow(
      "recommendations_request_failed:500",
    );
  });
});
