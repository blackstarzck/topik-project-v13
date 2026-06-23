import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const helpers = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  getWritingProblemMock: vi.fn(),
  getSubmissionMock: vi.fn(),
  getFeedbackBundleMock: vi.fn(),
  getComparisonReportMock: vi.fn(),
  getActiveDraftMock: vi.fn(),
  getWritingProblemAvailabilityMock: vi.fn(),
  notFoundMock: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  redirectMock: vi.fn((p: string) => {
    throw new Error(`REDIRECT:${p}`);
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: () => helpers.notFoundMock(),
  redirect: (p: string) => helpers.redirectMock(p),
}));

vi.mock("@/lib/auth/session", () => ({
  requireUser: () => helpers.requireUserMock(),
}));

vi.mock("@/lib/writing/server", () => ({
  getWritingProblem: (...args: unknown[]) =>
    helpers.getWritingProblemMock(...args),
  getSubmission: (id: string) => helpers.getSubmissionMock(id),
  getFeedbackBundle: (id: string) => helpers.getFeedbackBundleMock(id),
  getComparisonReport: (id: string) => helpers.getComparisonReportMock(id),
  getActiveDraft: (...args: unknown[]) =>
    helpers.getActiveDraftMock(...args),
  getWritingProblemAvailability: (...args: unknown[]) =>
    helpers.getWritingProblemAvailabilityMock(...args),
  isProblemIdLikeUuid: (value: unknown) =>
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    ),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () =>
    Promise.resolve({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                limit: () => ({
                  eq: () => Promise.resolve({ data: [] }),
                  then: (resolve: (v: unknown) => unknown) =>
                    resolve({ data: [] }),
                }),
              }),
            }),
          }),
        }),
      }),
    }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  helpers.requireUserMock.mockResolvedValue({
    id: "user-1",
    email: "u@example.com",
  });
  helpers.getWritingProblemAvailabilityMock.mockResolvedValue({
    canStart: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("writing flow — route guards", () => {
  const writingPages = {
    51: () =>
      import("../../src/app/(workspace)/writing/short-answer-writing-51/page"),
    52: () =>
      import("../../src/app/(workspace)/writing/answer-writing-52/page"),
    53: () =>
      import("../../src/app/(workspace)/writing/long-form-writing-53/page"),
    54: () =>
      import("../../src/app/(workspace)/writing/essay-writing-54/page"),
  } as const;

  it.each([51, 52, 53, 54] as const)(
    "/writing route for question %i uses its own static Wireframe-slug page",
    async (questionNo) => {
      helpers.getWritingProblemMock.mockResolvedValue(null);
      const page = await writingPages[questionNo]();
      const el = await page.default({
        searchParams: Promise.resolve({}),
      });

      expect(el).toBeTruthy();
      expect(helpers.getWritingProblemMock).toHaveBeenCalledWith(
        questionNo,
        undefined,
      );
    },
  );

  it("loads the active draft for a valid deep-linked problem even when the problem is no longer renderable", async () => {
    const problemId = "00000000-0000-0000-0000-000000000053";
    helpers.getWritingProblemMock.mockResolvedValue(null);
    helpers.getActiveDraftMock.mockResolvedValue({
      id: "draft-hidden",
      user_id: "user-1",
      problem_id: problemId,
      question_no: 53,
      answer_text: "preserved answer",
      answer_json: null,
      char_count: 16,
      autosave_status: "clean",
      last_saved_at: "2026-06-23T00:00:00Z",
      created_at: "2026-06-23T00:00:00Z",
      updated_at: "2026-06-23T00:00:00Z",
    });

    const page = await writingPages[53]();
    const el = await page.default({
      searchParams: Promise.resolve({ problem: problemId }),
    });

    expect(el).toBeTruthy();
    expect(helpers.getActiveDraftMock).toHaveBeenCalledWith(
      "user-1",
      problemId,
    );
  });

  it("/writing/feedback/short redirects to long for question 53", async () => {
    helpers.getSubmissionMock.mockResolvedValue({
      id: "s-1",
      user_id: "user-1",
      question_no: 53,
      feedback_status: "complete",
      problem_id: "p-1",
      answer_text: "x",
      char_count: 1,
      submitted_at: "2026-05-21T00:00:00Z",
      draft_id: null,
      answer_json: null,
      parent_submission_id: null,
    });
    const page = await import(
      "../../src/app/(workspace)/writing/feedback/short/[id]/page"
    );
    await expect(
      page.default({ params: Promise.resolve({ id: "s-1" }) }),
    ).rejects.toThrow("REDIRECT:/writing/feedback/long/s-1");
  });

  it("/writing/feedback/long shows pending panel when status='pending'", async () => {
    helpers.getSubmissionMock.mockResolvedValue({
      id: "s-2",
      user_id: "user-1",
      question_no: 53,
      feedback_status: "pending",
      problem_id: "p-1",
      answer_text: "x",
      char_count: 1,
      submitted_at: "2026-05-21T00:00:00Z",
      draft_id: null,
      answer_json: null,
      parent_submission_id: null,
    });
    const page = await import(
      "../../src/app/(workspace)/writing/feedback/long/[id]/page"
    );
    const el = await page.default({ params: Promise.resolve({ id: "s-2" }) });
    expect(el).toBeTruthy();
    expect(helpers.getFeedbackBundleMock).not.toHaveBeenCalled();
  });

  it("checks submitted problem availability before rendering feedback retry actions", async () => {
    helpers.getSubmissionMock.mockResolvedValue({
      id: "s-3",
      user_id: "user-1",
      question_no: 51,
      feedback_status: "complete",
      problem_id: "p-availability",
      answer_text: "x",
      char_count: 1,
      submitted_at: "2026-05-21T00:00:00Z",
      draft_id: null,
      answer_json: null,
      parent_submission_id: null,
    });
    helpers.getFeedbackBundleMock.mockResolvedValue({
      feedback: { status: "complete" },
      dimensions: [],
      sentences: [],
    });
    helpers.getWritingProblemAvailabilityMock.mockResolvedValue({
      canStart: false,
    });

    const page = await import(
      "../../src/app/(workspace)/writing/feedback/short/[id]/page"
    );
    const el = await page.default({ params: Promise.resolve({ id: "s-3" }) });

    expect(el).toBeTruthy();
    expect(helpers.getWritingProblemAvailabilityMock).toHaveBeenCalledWith(
      "p-availability",
    );
  });

  it("/writing/reports/[id]/compare renders with previous=null (empty diff)", async () => {
    helpers.getComparisonReportMock.mockResolvedValue({
      id: "r-1",
      user_id: "user-1",
      current_submission_id: "c-1",
      previous_submission_id: null,
      metrics: { no_previous: true, dimension_deltas: {} },
      narrative: "이전 제출이 없어 비교 항목이 부족합니다.",
      ai_model: "mock-v1",
      generated_at: "2026-05-21T00:00:00Z",
    });
    helpers.getSubmissionMock.mockResolvedValue({
      id: "c-1",
      user_id: "user-1",
      question_no: 53,
      feedback_status: "complete",
      problem_id: "p-1",
      answer_text: "이번 답안 본문",
      char_count: 8,
      submitted_at: "2026-05-21T00:00:00Z",
      draft_id: null,
      answer_json: null,
      parent_submission_id: null,
    });
    const page = await import(
      "../../src/app/(workspace)/writing/reports/[id]/compare/page"
    );
    const el = await page.default({ params: Promise.resolve({ id: "r-1" }) });
    expect(el).toBeTruthy();
  });
});
