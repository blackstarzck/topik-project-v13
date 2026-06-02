import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const helpers = vi.hoisted(() => ({
  hasLearningGoalMock: vi.fn(),
  getLearningGoalMock: vi.fn(),
  requireUserMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: helpers.redirectMock,
}));

vi.mock("@/lib/auth/session", () => ({
  requireUser: () => helpers.requireUserMock(),
}));

vi.mock("@/lib/learning/server", () => ({
  hasLearningGoal: (...args: unknown[]) => helpers.hasLearningGoalMock(...args),
  getLearningGoal: (...args: unknown[]) => helpers.getLearningGoalMock(...args),
}));

vi.mock("@/lib/learning/kpi", () => ({
  getDashboardKpi: () =>
    Promise.resolve({
      todayAttempts: 0,
      totalAttempts: 0,
      examDaysLeft: null,
      streakDays: 0,
      recentFeedback: null,
    }),
}));

// DashboardPage reads writing_feedback + writing_drafts for RecentFeedback +
// Alerts cards AND (recommendation build) getNextProblemBundle, which queries
// recommendation_items/runs via .or()/.filter()/.not()/.gte(). The mock makes
// every PostgREST builder method chainable and the chain itself thenable, so
// awaiting at any point resolves to an empty result set (no recommendation,
// no feedback, no drafts). This keeps the dashboard render path exercised end
// to end without a live DB.
vi.mock("@/lib/supabase/server", () => {
  const result = { data: [] as unknown[], count: 0, error: null };
  const emptyChain = {
    select: () => emptyChain,
    eq: () => emptyChain,
    or: () => emptyChain,
    filter: () => emptyChain,
    not: () => emptyChain,
    gte: () => emptyChain,
    order: () => emptyChain,
    limit: () => emptyChain,
    head: () => emptyChain,
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    single: () => Promise.resolve({ data: null, error: null }),
    then: (cb: (v: typeof result) => unknown) => cb(result),
  };
  return {
    createSupabaseServerClient: () =>
      Promise.resolve({
        from: () => emptyChain,
      }),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  helpers.requireUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("learning flow — onboarding gate", () => {
  it("redirects to /onboarding/learning-goal when no goal", async () => {
    helpers.getLearningGoalMock.mockResolvedValue(null);
    const mod = await import("../../src/app/(workspace)/dashboard/page");
    await expect(mod.default()).rejects.toThrow(
      "REDIRECT:/onboarding/learning-goal",
    );
  });

  it("renders dashboard when goal exists", async () => {
    helpers.getLearningGoalMock.mockResolvedValue({
      user_id: "user-1",
      topik_level: "TOPIK_II",
      target_grade: 5,
      exam_date: null,
      weekly_goal_minutes: null,
      weak_areas: [],
      is_active: true,
      updated_at: "2026-05-21T00:00:00Z",
    });
    const mod = await import("../../src/app/(workspace)/dashboard/page");
    const element = await mod.default();
    expect(element).toBeTruthy();
  });
});

describe("learning flow — submit goal → save → dashboard load", () => {
  it("persists goal then dashboard reads the saved row on next request", async () => {
    let stored: Record<string, unknown> | null = null;

    const { saveLearningGoal } = await import(
      "../../src/lib/learning/mutations"
    );

    const fakeClient = () => ({
      from: () => ({
        upsert: (input: Record<string, unknown>) => {
          stored = { ...input, updated_at: "2026-05-21T00:00:00Z" };
          return {
            select: () => ({
              single: () =>
                Promise.resolve({ data: stored, error: null }),
            }),
          };
        },
      }),
    });

    const saved = await saveLearningGoal(
      {
        user_id: "user-1",
        topik_level: "TOPIK_II",
        target_grade: 5,
      } as Parameters<typeof saveLearningGoal>[0],
      fakeClient as unknown as Parameters<typeof saveLearningGoal>[1],
    );
    expect(saved).toMatchObject({ user_id: "user-1", target_grade: 5 });
    expect(stored).not.toBeNull();

    helpers.getLearningGoalMock.mockResolvedValue(stored);
    const dashboard = await import(
      "../../src/app/(workspace)/dashboard/page"
    );
    const element = await dashboard.default();
    expect(element).toBeTruthy();
    expect(helpers.getLearningGoalMock).toHaveBeenCalledWith("user-1");
  });
});
