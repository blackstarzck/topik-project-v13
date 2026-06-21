import { beforeEach, describe, expect, it, vi } from "vitest";

const helpers = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  getSessionMock: vi.fn(),
  rpcMock: vi.fn(),
  serviceRpcMock: vi.fn(),
  createServiceClientMock: vi.fn(),
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
  createSupabaseServiceRoleClient: helpers.createServiceClientMock,
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
  createSupabaseServiceRoleClient: helpers.createServiceClientMock,
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
      // fetchProfileStatus(supabase, userId): profiles → select → eq → maybeSingle
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi
            .fn()
            .mockResolvedValue({ data: { status: "active" }, error: null }),
        })),
      })),
    });
    helpers.rpcMock.mockResolvedValue({
      data: "local-submission-id",
      error: null,
    });
    helpers.serviceRpcMock.mockResolvedValue({
      data: "00000000-0000-0000-0000-000000000099",
      error: null,
    });
    helpers.createServiceClientMock.mockReturnValue({
      rpc: helpers.serviceRpcMock,
    });
    delete process.env.TALKPIK_API_BASE_URL;
  });

  it("submits to the external OpenAPI writing endpoint and records the external submission locally", async () => {
    process.env.TALKPIK_API_BASE_URL = "https://api.example.test";
    const answerText = "External writing answer.";
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
      answer_text: answerText,
      char_count: answerText.length,
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
          task_id: "Q54",
          text: answerText,
          user_id: "current",
        }),
      }),
    );
    expect(helpers.rpcMock).not.toHaveBeenCalledWith(
      "create_external_writing_submission",
      expect.anything(),
    );
    expect(helpers.serviceRpcMock).toHaveBeenCalledWith(
      "create_external_writing_submission",
      {
        submission: {
          external_submission_id: "00000000-0000-0000-0000-000000000099",
          user_id: "user-1",
          problem_id: "00000000-0000-0000-0000-000000000001",
          draft_id: null,
          question_no: 54,
          answer_text: answerText,
          answer_json: null,
          char_count: answerText.length,
          feedback_status: "analyzing",
        },
      },
    );
    expect(result).toEqual({
      submissionId: "00000000-0000-0000-0000-000000000099",
      questionNo: 54,
    });
  });

  it("fails before queueing externally when the service role writer is unavailable", async () => {
    process.env.TALKPIK_API_BASE_URL = "https://api.example.test";
    helpers.createServiceClientMock.mockImplementation(() => {
      throw new Error("service role unavailable");
    });
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

    await expect(
      submitWritingAction({
        problem_id: "00000000-0000-0000-0000-000000000001",
        question_no: 54,
        answer_text: "External writing answer.",
        char_count: 24,
      }),
    ).rejects.toThrow("service role unavailable");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("records local submissions as failed without writing mock feedback when the external API is unavailable", async () => {
    const answerText = "Local writing answer.";
    helpers.serviceRpcMock.mockImplementation((rpcName, payload) =>
      Promise.resolve({
        data: (payload as { submission: { external_submission_id: string } })
          .submission.external_submission_id,
        error: null,
      }),
    );

    const result = await submitWritingAction({
      problem_id: "00000000-0000-0000-0000-000000000001",
      question_no: 51,
      answer_text: answerText,
      char_count: answerText.length,
    });

    expect(helpers.rpcMock).not.toHaveBeenCalledWith(
      "submit_writing_with_feedback",
      expect.anything(),
    );
    expect(helpers.serviceRpcMock).toHaveBeenCalledTimes(1);
    const [rpcName, rpcPayload] = helpers.serviceRpcMock.mock.calls[0] as [
      string,
      {
        submission: {
          external_submission_id: string;
          feedback_status: string;
        };
      },
    ];
    expect(rpcName).toBe("create_external_writing_submission");
    expect(rpcPayload.submission).toMatchObject({
      external_submission_id: expect.any(String),
      user_id: "user-1",
      problem_id: "00000000-0000-0000-0000-000000000001",
      draft_id: null,
      question_no: 51,
      answer_text: answerText,
      answer_json: null,
      char_count: answerText.length,
      feedback_status: "failed",
    });
    expect(rpcPayload.submission.external_submission_id).toMatch(
      /^[0-9a-f-]{36}$/,
    );
    expect(result).toEqual({
      submissionId: rpcPayload.submission.external_submission_id,
      questionNo: 51,
    });
  });

  it("records a failed local submission when the configured external API cannot be reached", async () => {
    process.env.TALKPIK_API_BASE_URL = "https://api.example.test";
    const answerText = "External API network failure answer.";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new TypeError("fetch failed"));
    helpers.serviceRpcMock.mockImplementation((rpcName, payload) =>
      Promise.resolve({
        data: (payload as { submission: { external_submission_id: string } })
          .submission.external_submission_id,
        error: null,
      }),
    );

    const result = await submitWritingAction({
      problem_id: "00000000-0000-0000-0000-000000000001",
      question_no: 51,
      answer_text: answerText,
      char_count: answerText.length,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/writing/submit",
      expect.anything(),
    );
    expect(helpers.serviceRpcMock).toHaveBeenCalledTimes(1);
    const [rpcName, rpcPayload] = helpers.serviceRpcMock.mock.calls[0] as [
      string,
      {
        submission: {
          external_submission_id: string;
          feedback_status: string;
        };
      },
    ];
    expect(rpcName).toBe("create_external_writing_submission");
    expect(rpcPayload.submission).toMatchObject({
      external_submission_id: expect.any(String),
      user_id: "user-1",
      problem_id: "00000000-0000-0000-0000-000000000001",
      draft_id: null,
      question_no: 51,
      answer_text: answerText,
      answer_json: null,
      char_count: answerText.length,
      feedback_status: "failed",
    });
    expect(result).toEqual({
      submissionId: rpcPayload.submission.external_submission_id,
      questionNo: 51,
    });
  });

  it("records a failed local submission when the external API returns a server error", async () => {
    process.env.TALKPIK_API_BASE_URL = "https://api.example.test";
    const answerText = "External API server error answer.";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "upstream unavailable" }), {
        status: 500,
      }),
    );
    helpers.serviceRpcMock.mockImplementation((rpcName, payload) =>
      Promise.resolve({
        data: (payload as { submission: { external_submission_id: string } })
          .submission.external_submission_id,
        error: null,
      }),
    );

    const result = await submitWritingAction({
      problem_id: "00000000-0000-0000-0000-000000000001",
      question_no: 54,
      answer_text: answerText,
      char_count: answerText.length,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/writing/submit",
      expect.anything(),
    );
    expect(helpers.serviceRpcMock).toHaveBeenCalledTimes(1);
    const [rpcName, rpcPayload] = helpers.serviceRpcMock.mock.calls[0] as [
      string,
      {
        submission: {
          external_submission_id: string;
          feedback_status: string;
        };
      },
    ];
    expect(rpcName).toBe("create_external_writing_submission");
    expect(rpcPayload.submission).toMatchObject({
      external_submission_id: expect.any(String),
      user_id: "user-1",
      problem_id: "00000000-0000-0000-0000-000000000001",
      draft_id: null,
      question_no: 54,
      answer_text: answerText,
      answer_json: null,
      char_count: answerText.length,
      feedback_status: "failed",
    });
    expect(result).toEqual({
      submissionId: rpcPayload.submission.external_submission_id,
      questionNo: 54,
    });
  });

  it("does not record a local failed submission for external API HTTP errors", async () => {
    process.env.TALKPIK_API_BASE_URL = "https://api.example.test";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "unauthorized" }), {
        status: 401,
      }),
    );

    await expect(
      submitWritingAction({
        problem_id: "00000000-0000-0000-0000-000000000001",
        question_no: 51,
        answer_text: "External API unauthorized answer.",
        char_count: 33,
      }),
    ).rejects.toThrow("External evaluation API request failed with status 401");

    expect(fetchMock).toHaveBeenCalled();
    expect(helpers.serviceRpcMock).not.toHaveBeenCalled();
  });

  it("shows a learner-friendly error when the selected problem is no longer submittable", async () => {
    helpers.serviceRpcMock.mockResolvedValue({
      data: null,
      error: { message: "problem_not_submittable" },
    });

    await expect(
      submitWritingAction({
        problem_id: "00000000-0000-0000-0000-000000000001",
        question_no: 51,
        answer_text: "Answer for a hidden problem.",
        char_count: 28,
      }),
    ).rejects.toThrow("현재 제출할 수 없는 문제입니다. 다른 문제를 선택해 주세요.");
  });

  it("shows a learner-friendly error when the external create RPC rejects an unsubmittable problem", async () => {
    process.env.TALKPIK_API_BASE_URL = "https://api.example.test";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          submission_id: "00000000-0000-0000-0000-000000000099",
          status: "processing",
          message: "queued",
        }),
        { status: 202 },
      ),
    );
    helpers.serviceRpcMock.mockResolvedValue({
      data: null,
      error: { message: "problem_not_submittable" },
    });

    await expect(
      submitWritingAction({
        problem_id: "00000000-0000-0000-0000-000000000001",
        question_no: 51,
        answer_text: "Answer for a hidden problem.",
        char_count: 28,
      }),
    ).rejects.toThrow("현재 제출할 수 없는 문제입니다. 다른 문제를 선택해 주세요.");
  });

  it("returns the existing submission id when the external create RPC dedups a duplicate submit", async () => {
    process.env.TALKPIK_API_BASE_URL = "https://api.example.test";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          submission_id: "00000000-0000-0000-0000-0000000000bb",
          status: "processing",
          message: "queued",
        }),
        { status: 202 },
      ),
    );
    // 중복 제출이면 RPC가 새 row를 만들지 않고 기존 활성 제출 id를 멱등 반환한다.
    // 이 값은 이번 호출의 external.submission_id(...bb)와 다르다.
    helpers.serviceRpcMock.mockResolvedValue({
      data: "00000000-0000-0000-0000-0000000000aa",
      error: null,
    });

    const result = await submitWritingAction({
      draft_id: "00000000-0000-0000-0000-0000000000dd",
      problem_id: "00000000-0000-0000-0000-000000000001",
      question_no: 54,
      answer_text: "Duplicate submit answer.",
      char_count: 24,
    });

    // mismatch 에러를 던지지 않고, RPC가 반환한 기존 제출 id로 수렴한다.
    expect(result).toEqual({
      submissionId: "00000000-0000-0000-0000-0000000000aa",
      questionNo: 54,
    });
  });
});
