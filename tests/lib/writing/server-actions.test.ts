import { beforeEach, describe, expect, it, vi } from "vitest";

const helpers = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  getSessionMock: vi.fn(),
  rpcMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () =>
    Promise.resolve({
      auth: {
        getUser: helpers.getUserMock,
        getSession: helpers.getSessionMock,
      },
      rpc: helpers.rpcMock,
      from: helpers.fromMock,
    }),
}));

vi.mock("../../../src/lib/supabase/server", () => ({
  createSupabaseServerClient: () =>
    Promise.resolve({
      auth: {
        getUser: helpers.getUserMock,
        getSession: helpers.getSessionMock,
      },
      rpc: helpers.rpcMock,
      from: helpers.fromMock,
    }),
}));

import { submitWritingAction } from "../../../src/lib/writing/server-actions";

describe("submitWritingAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    helpers.getUserMock.mockResolvedValue({
      data: {
        user: { id: "user-1" },
      },
    });
    helpers.getSessionMock.mockResolvedValue({
      data: {
        session: { access_token: "learner-token" },
      },
    });
    helpers.fromMock.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    });
    delete process.env.TALKPIK_WRITING_API_BASE_URL;
  });

  it("submits to the external OpenAPI writing endpoint when configured", async () => {
    process.env.TALKPIK_WRITING_API_BASE_URL = "https://api.example.test";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          submission_id: "00000000-0000-0000-0000-000000000099",
          status: "processing",
          message: "queued",
        }),
        { status: 202 },
      ),
    );

    const result = await submitWritingAction({
      problem_id: "00000000-0000-0000-0000-000000000001",
      question_no: 54,
      answer_text: "현대 사회에서 의사소통은 매우 중요합니다.",
      char_count: 22,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/writing/submit",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer learner-token",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          task_type: "Q54",
          task_id: "00000000-0000-0000-0000-000000000001",
          text: "현대 사회에서 의사소통은 매우 중요합니다.",
          user_id: "user-1",
          lang: "ko",
          passage_context: "",
        }),
      }),
    );
    expect(helpers.rpcMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      submissionId: "00000000-0000-0000-0000-000000000099",
      questionNo: 54,
    });
  });

  it("shows a learner-friendly error when the selected problem is no longer submittable", async () => {
    helpers.rpcMock.mockResolvedValue({
      data: null,
      error: { message: "problem_not_submittable" },
    });

    await expect(
      submitWritingAction({
        problem_id: "00000000-0000-0000-0000-000000000001",
        question_no: 51,
        answer_text: "문제를 풀고 답안을 작성했습니다.",
        char_count: 16,
      }),
    ).rejects.toThrow("현재 제출할 수 없는 문제입니다. 다른 문제를 선택해 주세요.");
  });
});
