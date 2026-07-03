import { describe, expect, it } from "vitest";
import {
  getLearningGoal,
  hasLearningGoal,
} from "../../../src/lib/learning/server";

function makeClient(opts: {
  count?: number | null;
  data?: Record<string, unknown> | null;
  error?: { message: string } | null;
}) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          // head:true count call
          count: opts.count ?? null,
          error: opts.error ?? null,
          maybeSingle: () =>
            Promise.resolve({
              data: opts.data ?? null,
              error: opts.error ?? null,
            }),
          // count call returns directly via destructure
        }),
      }),
    }),
  };
}

// Supabase's `.select(_, { count: 'exact', head: true })` returns a thenable
// shape { count, error }. The chain above resolves through the eq() return,
// so the helper test below builds it explicitly.
function makeCountClient(
  count: number | null,
  error: { message: string } | null = null,
) {
  return {
    from: () => ({
      select: () => ({
        eq: () =>
          Promise.resolve({
            count,
            error,
          }),
      }),
    }),
  };
}

describe("hasLearningGoal", () => {
  it("returns true when the user has a row", async () => {
    const create = async () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeCountClient(1) as any;
    expect(await hasLearningGoal("user-1", create)).toBe(true);
  });

  it("returns false when the user has no row", async () => {
    const create = async () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeCountClient(0) as any;
    expect(await hasLearningGoal("user-1", create)).toBe(false);
  });

  it("returns false when count is null (no rows visible)", async () => {
    const create = async () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeCountClient(null) as any;
    expect(await hasLearningGoal("user-1", create)).toBe(false);
  });

  it("throws when supabase returns an error", async () => {
    const create = async () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeCountClient(null, { message: "permission denied" }) as any;
    await expect(hasLearningGoal("user-1", create)).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe("getLearningGoal", () => {
  it("returns the row when present", async () => {
    const goal = {
      user_id: "user-1",
      topik_level: "TOPIK_II" as const,
      target_grade: 5,
      exam_date: "2026-09-15",
      weekly_goal_minutes: 240,
      weak_areas: ["essay-thesis", "subject-verb-agreement"],
      is_active: true,
      updated_at: "2026-05-21T00:00:00Z",
    };
    const create = async () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeClient({ data: goal }) as any;
    const result = await getLearningGoal("user-1", create);
    expect(result?.target_grade).toBe(5);
    expect(result?.weak_areas.length).toBe(2);
  });

  it("returns null when no row", async () => {
    const create = async () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeClient({ data: null }) as any;
    expect(await getLearningGoal("user-1", create)).toBe(null);
  });

  it("throws when supabase returns an error", async () => {
    const create = async () =>
      makeClient({
        data: null,
        error: { message: "transient db error" },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any;
    await expect(getLearningGoal("user-1", create)).rejects.toThrow(
      /transient db error/,
    );
  });
});
