import { describe, expect, it } from "vitest";

import type { FeedbackStatus } from "../../../src/lib/writing/types";
import { isFeedbackComplete } from "../../../src/lib/writing/types";

// The polling contract: useFeedbackStatus returns refetchInterval=10000
// while status is pending/analyzing, and false once status is
// complete/failed. We verify the underlying boolean rule here as the
// component-free contract — the hook only wraps useQuery around it.
// (Cadence: 10s interval, max 6 attempts ≈ 60s window before graceful timeout.)

describe("feedback status polling contract", () => {
  it("returns 10000 ms while pending or analyzing", () => {
    const interval = (status: FeedbackStatus | null) =>
      !status || !isFeedbackComplete(status) ? 10000 : false;
    expect(interval(null)).toBe(10000);
    expect(interval("pending")).toBe(10000);
    expect(interval("analyzing")).toBe(10000);
  });
  it("returns false once status is complete or failed", () => {
    const interval = (status: FeedbackStatus | null) =>
      !status || !isFeedbackComplete(status) ? 10000 : false;
    expect(interval("complete")).toBe(false);
    expect(interval("failed")).toBe(false);
  });
});
