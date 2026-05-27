import { describe, expect, it } from "vitest";
import {
  fetchLearningGoal,
  learningGoalQueryKey,
} from "../../../src/lib/learning/queries";

function makeClient(opts: {
  data?: Record<string, unknown> | null;
  error?: { message: string } | null;
}) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: opts.data ?? null,
              error: opts.error ?? null,
            }),
        }),
      }),
    }),
  };
}

describe("learningGoalQueryKey", () => {
  it("returns a stable tuple", () => {
    expect(learningGoalQueryKey("user-1")).toEqual(["learning-goal", "user-1"]);
  });

  it("differs per user", () => {
    expect(learningGoalQueryKey("a")).not.toEqual(learningGoalQueryKey("b"));
  });
});

describe("fetchLearningGoal", () => {
  it("returns the row when present", async () => {
    const goal = {
      user_id: "user-1",
      topik_level: "TOPIK_II" as const,
      target_grade: 5,
      exam_date: null,
      weekly_goal_minutes: null,
      weak_areas: [] as string[],
      is_active: true,
      updated_at: "2026-05-21T00:00:00Z",
    };
    const result = await fetchLearningGoal(
      "user-1",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => makeClient({ data: goal }) as any,
    );
    expect(result?.target_grade).toBe(5);
  });

  it("returns null when not found", async () => {
    const result = await fetchLearningGoal(
      "user-x",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => makeClient({ data: null }) as any,
    );
    expect(result).toBe(null);
  });

  it("throws when supabase errors", async () => {
    await expect(
      fetchLearningGoal(
        "user-1",
        () =>
          makeClient({
            data: null,
            error: { message: "boom" },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          }) as any,
      ),
    ).rejects.toThrow(/boom/);
  });
});
