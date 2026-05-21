import { describe, expect, it } from "vitest";

import type { FeedbackStatus } from "../../../src/lib/writing/types";
import { isFeedbackComplete } from "../../../src/lib/writing/types";

// The polling contract: useFeedbackStatus returns refetchInterval=5000
// while status is pending/analyzing, and false once status is
// complete/failed. We verify the underlying boolean rule here as the
// component-free contract — the hook only wraps useQuery around it.

describe("feedback status polling contract", () => {
  it("returns 5000 ms while pending or analyzing", () => {
    const interval = (status: FeedbackStatus | null) =>
      !status || !isFeedbackComplete(status) ? 5000 : false;
    expect(interval(null)).toBe(5000);
    expect(interval("pending")).toBe(5000);
    expect(interval("analyzing")).toBe(5000);
  });
  it("returns false once status is complete or failed", () => {
    const interval = (status: FeedbackStatus | null) =>
      !status || !isFeedbackComplete(status) ? 5000 : false;
    expect(interval("complete")).toBe(false);
    expect(interval("failed")).toBe(false);
  });
});
