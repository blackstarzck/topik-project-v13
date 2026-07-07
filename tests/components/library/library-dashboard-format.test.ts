import { describe, expect, it } from "vitest";

import { formatDashboardInactiveDuration } from "../../../src/components/library/library-dashboard-format";

const NOW_MS = new Date("2026-07-04T12:00:00.000Z").getTime();

describe("formatDashboardInactiveDuration", () => {
  it.each([
    ["2025-07-04T12:00:00.000Z", "1년"],
    ["2026-06-04T12:00:00.000Z", "1개월"],
    ["2026-06-27T12:00:00.000Z", "1주"],
    ["2026-07-02T12:00:00.000Z", "2일"],
  ])("formats Korean inactive duration for %s", (iso, expected) => {
    expect(formatDashboardInactiveDuration(iso, "ko", NOW_MS)).toBe(expected);
  });

  it("returns null when there is no recent study date", () => {
    expect(formatDashboardInactiveDuration(null, "ko", NOW_MS)).toBeNull();
  });
});
