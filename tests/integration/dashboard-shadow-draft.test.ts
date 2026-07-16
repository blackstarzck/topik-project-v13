import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  canonicalError: null as string | null,
  canonicalRows: [] as Array<Record<string, unknown>>,
}));

vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}));

vi.mock("@/lib/auth/session", () => ({
  requireUser: async () => ({ id: "user-1", email: "u@example.com" }),
}));

vi.mock("@/lib/learning/server", () => ({
  getLearningGoal: async () => ({
    user_id: "user-1",
    topik_level: "TOPIK_II",
    target_grade: 5,
    exam_date: null,
  }),
}));

vi.mock("@/lib/learning/kpi", () => ({
  getDashboardKpi: async () => ({ todayAttempts: 0, totalAttempts: 0, streakDays: 0 }),
}));

vi.mock("@/lib/practice/next", () => ({
  getNextProblemBundle: async () => ({ primary: null, primaryTier: 4, alternatives: [] }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    from: (table: string) => makeQuery(table),
    rpc: (name: string) => {
      if (name !== "get_available_writing_questions") {
        throw new Error(`unexpected rpc ${name}`);
      }
      return Promise.resolve({
        data: fixture.canonicalRows,
        error: fixture.canonicalError ? { message: fixture.canonicalError } : null,
      });
    },
  }),
}));

function makeQuery(table: string) {
  const rows = table === "writing_drafts"
    ? [{
        problem_id: "problem-51",
        question_no: 51,
        answer_text: "draft answer",
        answer_json: null,
        char_count: 12,
        autosave_status: "clean",
        last_saved_at: "2026-07-01T10:00:00.000Z",
        updated_at: "2026-07-01T10:00:00.000Z",
      }]
    : [];
  const chain = {
    select: () => chain,
    eq: () => chain,
    neq: () => chain,
    order: () => chain,
    limit: () => Promise.resolve({ data: rows, error: null }),
  };
  return chain;
}

beforeEach(() => {
  fixture.canonicalError = null;
  fixture.canonicalRows = [];
});

describe("DashboardPage canonical draft card", () => {
  it("hydrates a saved draft card from canonical current metadata", async () => {
    fixture.canonicalRows = [canonicalRow("Canonical dashboard draft")];
    const { default: DashboardPage } = await import(
      "../../src/app/(workspace)/dashboard/page"
    );

    const page = (await DashboardPage()) as unknown as {
      props: { children: Array<{ props?: Record<string, unknown> }> };
    };
    const dashboardBody = page.props.children.at(-1);

    expect(dashboardBody?.props?.continueDraft).toMatchObject({
      problemId: "problem-51",
      title: "Canonical dashboard draft",
      questionNo: 51,
    });
  });

  it("does not render a current-content card for a draft whose question is no longer published", async () => {
    const { default: DashboardPage } = await import(
      "../../src/app/(workspace)/dashboard/page"
    );

    const page = (await DashboardPage()) as unknown as {
      props: { children: Array<{ props?: Record<string, unknown> }> };
    };
    const dashboardBody = page.props.children.at(-1);

    expect(dashboardBody?.props?.continueDraft).toBeNull();
  });

  it("fails the current dashboard request when canonical content cannot be read", async () => {
    fixture.canonicalError = "catalog unavailable";
    const { default: DashboardPage } = await import(
      "../../src/app/(workspace)/dashboard/page"
    );

    await expect(DashboardPage()).rejects.toThrow(
      "getCanonicalWritingProblems: catalog unavailable",
    );
  });
});

function canonicalRow(title: string) {
  return {
    problem_id: "problem-51",
    question_id: "topik-writing-51-0001",
    canonical_import_id: 101,
    payload_hash: "hash-problem-51",
    item_number: 51,
    topik_level: 2,
    difficulty: 3,
    title,
    prompt: "Writing prompt",
    tags: [],
    materials: {},
    source_created_at: "2026-07-13T00:00:00.000Z",
    source_updated_at: "2026-07-13T00:00:00.000Z",
  };
}
