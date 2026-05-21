import { describe, expect, it } from "vitest";
import {
  saveLearningGoal,
  type SaveLearningGoalInput,
} from "../../../src/lib/learning/mutations";

function makeClient(opts: {
  data?: Record<string, unknown> | null;
  error?: { message: string } | null;
}) {
  return {
    from: () => ({
      upsert: () => ({
        select: () => ({
          single: () =>
            Promise.resolve({
              data: opts.data ?? null,
              error: opts.error ?? null,
            }),
        }),
      }),
    }),
  };
}

const INPUT: SaveLearningGoalInput = {
  user_id: "user-1",
  topik_level: "TOPIK_II",
  target_grade: 5,
  exam_date: "2026-09-15",
  weekly_goal_minutes: 240,
  weak_areas: ["essay-thesis"],
  is_active: true,
};

describe("saveLearningGoal", () => {
  it("returns the upserted row on success", async () => {
    const row = { ...INPUT, updated_at: "2026-05-21T00:00:00Z" };
    const result = await saveLearningGoal(
      INPUT,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => makeClient({ data: row }) as any,
    );
    expect(result.target_grade).toBe(5);
  });

  it("throws when supabase returns error", async () => {
    await expect(
      saveLearningGoal(
        INPUT,
        () =>
          makeClient({
            data: null,
            error: { message: "permission denied" },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          }) as any,
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("throws when supabase returns no row", async () => {
    await expect(
      saveLearningGoal(
        INPUT,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        () => makeClient({ data: null }) as any,
      ),
    ).rejects.toThrow(/no row/);
  });
});
