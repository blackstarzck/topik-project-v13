import { describe, expect, it } from "vitest";
import { APP_ROUTES, computeSidebarLocks } from "../../src/lib/routes";

describe("computeSidebarLocks", () => {
  it("locks writing route leaves for unavailable question types", () => {
    const locks = computeSidebarLocks({
      role: "learner",
      planLabel: null,
      lockedWritingTypes: new Set([51, 54]),
    });

    expect(locks[APP_ROUTES.writing51]).toBe("writingTypeLocked");
    expect(locks[APP_ROUTES.writing54]).toBe("writingTypeLocked");
    expect(locks[APP_ROUTES.writing52]).toBeUndefined();
    expect(locks[APP_ROUTES.practiceProblems]).toBeUndefined();
  });
});
