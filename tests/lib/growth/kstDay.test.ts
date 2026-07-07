import { describe, expect, it } from "vitest";
import { kstDayKey } from "../../../src/lib/growth/kstDay";

describe("kstDayKey", () => {
  it("buckets timestamps by KST calendar day, not UTC", () => {
    // 14:59 UTC = 23:59 KST → 같은 날.
    expect(kstDayKey("2026-07-03T14:59:59Z")).toBe("2026-07-03");
    // 15:00 UTC = 다음 날 00:00 KST → 다음 날.
    expect(kstDayKey("2026-07-03T15:00:00Z")).toBe("2026-07-04");
  });

  it("accepts epoch ms and Date inputs with the same bucketing", () => {
    const ms = Date.UTC(2026, 6, 3, 15, 0, 0);
    expect(kstDayKey(ms)).toBe("2026-07-04");
    expect(kstDayKey(new Date(ms))).toBe("2026-07-04");
  });

  it("keeps a YYYY-MM-DD input on the same day (UTC midnight = 09:00 KST)", () => {
    expect(kstDayKey("2026-07-03")).toBe("2026-07-03");
  });
});
