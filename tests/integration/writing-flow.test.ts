import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const helpers = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  getSubmissionMock: vi.fn(),
  getFeedbackBundleMock: vi.fn(),
  getComparisonReportMock: vi.fn(),
  getActiveDraftMock: vi.fn(),
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
  getSubmission: (id: string) => helpers.getSubmissionMock(id),
  getFeedbackBundle: (id: string) => helpers.getFeedbackBundleMock(id),
  getComparisonReport: (id: string) => helpers.getComparisonReportMock(id),
  getActiveDraft: (...args: unknown[]) =>
    helpers.getActiveDraftMock(...args),
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
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("writing flow — route guards", () => {
  it("/writing/[questionId] notFound when questionId=99", async () => {
    const page = await import(
      "../../src/app/(workspace)/writing/[questionId]/page"
    );
    await expect(
      page.default({
        params: Promise.resolve({ questionId: "99" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NOT_FOUND");
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
