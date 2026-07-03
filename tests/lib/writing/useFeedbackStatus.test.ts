import { describe, expect, it } from "vitest";

import type { FeedbackStatus } from "../../../src/lib/writing/types";
import {
  getFeedbackStatusRefetchInterval,
  isFeedbackStatusPollingExhausted,
} from "../../../src/lib/writing/queries";

// The polling contract: useFeedbackStatus returns refetchInterval=10000
// while status is pending/analyzing, and false once status is
// complete/failed. We verify the underlying boolean rule here as the
// component-free contract — the hook only wraps useQuery around it.
// Cadence: 10s interval, max 2 status updates before library handoff.

describe("feedback status polling contract", () => {
  it("returns 10000 ms while pending or analyzing", () => {
    expect(getFeedbackStatusRefetchInterval(undefined, 0)).toBe(10000);
    expect(getFeedbackStatusRefetchInterval("pending", 1)).toBe(10000);
    expect(getFeedbackStatusRefetchInterval("analyzing", 1)).toBe(10000);
  });

  it("returns false once status is complete or failed", () => {
    expect(getFeedbackStatusRefetchInterval("complete", 1)).toBe(false);
    expect(getFeedbackStatusRefetchInterval("failed", 1)).toBe(false);
  });

  it("stops polling after the configured attempt window", () => {
    expect(getFeedbackStatusRefetchInterval("analyzing", 2)).toBe(false);
    expect(getFeedbackStatusRefetchInterval("pending", 2)).toBe(false);
  });

  it("exposes an exhausted state only for incomplete statuses after max attempts", () => {
    const exhausted = (status: FeedbackStatus | null | undefined) =>
      isFeedbackStatusPollingExhausted(status, 2);

    expect(isFeedbackStatusPollingExhausted("analyzing", 1)).toBe(false);
    expect(exhausted("pending")).toBe(true);
    expect(exhausted("analyzing")).toBe(true);
    expect(exhausted("complete")).toBe(false);
    expect(exhausted("failed")).toBe(false);
    expect(exhausted(null)).toBe(false);
    expect(exhausted(undefined)).toBe(false);
  });
});
