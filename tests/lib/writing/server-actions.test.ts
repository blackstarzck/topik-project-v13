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

import {
  createComparisonReportAction,
  createComparisonReportWithViewAction,
  submitWritingAction,
} from "../../../src/lib/writing/server-actions";
import { WRITING_PROBLEM_NOT_SUBMITTABLE_MESSAGE } from "../../../src/lib/writing/submit-errors";

type ComparisonRow = Record<string, unknown>;
type ComparisonStore = {
  profiles: ComparisonRow[];
  comparison_reports: ComparisonRow[];
  writing_submissions: ComparisonRow[];
  writing_feedback: ComparisonRow[];
  feedback_dimension_scores: ComparisonRow[];
};

function createComparisonQuery(rows: ComparisonRow[]) {
  let result = [...rows];
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn((column: string, value: unknown) => {
      result = result.filter((row) => row[column] === value);
      return query;
    }),
    neq: vi.fn((column: string, value: unknown) => {
      result = result.filter((row) => row[column] !== value);
      return query;
    }),
    in: vi.fn((column: string, values: unknown[]) => {
      result = result.filter((row) => values.includes(row[column]));
      return query;
    }),
    lt: vi.fn((column: string, value: unknown) => {
      result = result.filter((row) => String(row[column]) < String(value));
      return query;
    }),
    order: vi.fn(
      (column: string, options?: { ascending?: boolean | undefined }) => {
        const factor = options?.ascending === false ? -1 : 1;
        result = [...result].sort((a, b) =>
          String(a[column]) > String(b[column]) ? factor : -factor,
        );
        return query;
      },
    ),
    limit: vi.fn((count: number) => {
      result = result.slice(0, count);
      return query;
    }),
    maybeSingle: vi.fn(() =>
      Promise.resolve({ data: result[0] ?? null, error: null }),
    ),
    then: (
      onFulfilled?: (value: { data: ComparisonRow[]; error: null }) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) =>
      Promise.resolve({ data: result, error: null }).then(
        onFulfilled,
        onRejected,
      ),
  };
  return query;
}

function mockComparisonStore(store: Partial<ComparisonStore>) {
  const tables: ComparisonStore = {
    profiles: [{ id: "user-1", status: "active" }],
    comparison_reports: [],
    writing_submissions: [],
    writing_feedback: [],
    feedback_dimension_scores: [],
    ...store,
  };
  helpers.fromMock.mockImplementation((table: keyof ComparisonStore) =>
    createComparisonQuery(tables[table] ?? []),
  );
}

function submissionRow(overrides: Partial<ComparisonRow>): ComparisonRow {
  return {
    id: "submission-id",
    user_id: "user-1",
    problem_id: "problem-1",
    question_no: 53,
    answer_text: "answer",
    answer_json: null,
    char_count: 100,
    feedback_status: "complete",
    draft_id: null,
    parent_submission_id: null,
    submitted_at: "2026-06-20T00:00:00.000Z",
    ...overrides,
  };
}

function feedbackRow(
  submissionId: string,
  scoreTotal: number,
  scoreMax = 100,
  rawAiResult: unknown = null,
): ComparisonRow {
  return {
    id: `${submissionId}-feedback`,
    submission_id: submissionId,
    user_id: "user-1",
    status: "complete",
    score_total: scoreTotal,
    score_max: scoreMax,
    overall_summary: "",
    raw_ai_result: rawAiResult,
    ai_model: "test",
    ai_model_version: "test",
    created_at: "2026-06-20T00:00:00.000Z",
  };
}

function dimensionRow(submissionId: string, score: number): ComparisonRow {
  return {
    id: `${submissionId}-grammar`,
    submission_id: submissionId,
    user_id: "user-1",
    dimension: "grammar",
    score,
    score_max: 100,
    summary: "",
    weakness_level: null,
  };
}

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
      // submitWritingAction는 problems.materials.question_id를 외부 question_id로 읽는다.
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { materials: { question_id: "topik-writing-54-0001" } },
              error: null,
            }),
          })),
        })),
      })),
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
          question_id: "topik-writing-54-0001",
          text: answerText,
          lang: "ko",
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

  it("records the source submission when retry feedback is submitted successfully", async () => {
    process.env.TALKPIK_API_BASE_URL = "https://api.example.test";
    const answerText = "Revised external writing answer.";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          submission_id: "00000000-0000-0000-0000-0000000000bb",
          status: "processing",
        }),
        { status: 202 },
      ),
    );

    await submitWritingAction({
      parent_submission_id: "00000000-0000-0000-0000-000000000011",
      problem_id: "00000000-0000-0000-0000-000000000001",
      question_no: 54,
      answer_text: answerText,
      char_count: answerText.length,
    });

    expect(helpers.serviceRpcMock).toHaveBeenCalledWith(
      "create_external_writing_submission",
      {
        submission: expect.objectContaining({
          external_submission_id: "00000000-0000-0000-0000-0000000000bb",
          user_id: "user-1",
          problem_id: "00000000-0000-0000-0000-000000000001",
          parent_submission_id: "00000000-0000-0000-0000-000000000011",
          feedback_status: "analyzing",
        }),
      },
    );
  });

  it("submits Q51 as blanks (not raw text) when answer_json carries them", async () => {
    process.env.TALKPIK_API_BASE_URL = "https://api.example.test";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          submission_id: "00000000-0000-0000-0000-0000000000aa",
          status: "processing",
        }),
        { status: 202 },
      ),
    );

    await submitWritingAction({
      problem_id: "00000000-0000-0000-0000-000000000001",
      question_no: 51,
      answer_text: "ㄱ: 잘 수 없습니다\nㄴ: 알려 주시면",
      answer_json: {
        _v: "51.v1",
        blanks: { ㄱ: "잘 수 없습니다", ㄴ: "알려 주시면" },
      },
      passage_context:
        "지금 사용하고 있는 방은 도로와 가까워서 잠을 ( ㄱ ). 방법을 ( ㄴ ) 감사하겠습니다.",
      char_count: 12,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/writing/submit",
      expect.objectContaining({
        body: JSON.stringify({
          task_type: "Q51",
          question_id: "topik-writing-54-0001",
          blanks: { ㄱ: "잘 수 없습니다", ㄴ: "알려 주시면" },
          passage_context:
            "지금 사용하고 있는 방은 도로와 가까워서 잠을 ( ㄱ ). 방법을 ( ㄴ ) 감사하겠습니다.",
          lang: "ko",
        }),
      }),
    );
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

  it("preserves the source submission when a retry falls back to a failed local submission", async () => {
    const answerText = "Retry fallback answer.";
    helpers.serviceRpcMock.mockImplementation((rpcName, payload) =>
      Promise.resolve({
        data: (payload as { submission: { external_submission_id: string } })
          .submission.external_submission_id,
        error: null,
      }),
    );

    await submitWritingAction({
      parent_submission_id: "00000000-0000-0000-0000-000000000011",
      problem_id: "00000000-0000-0000-0000-000000000001",
      question_no: 53,
      answer_text: answerText,
      char_count: answerText.length,
    });

    const [, rpcPayload] = helpers.serviceRpcMock.mock.calls[0] as [
      string,
      {
        submission: {
          parent_submission_id?: string;
        };
      },
    ];
    expect(rpcPayload.submission.parent_submission_id).toBe(
      "00000000-0000-0000-0000-000000000011",
    );
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
    ).rejects.toThrow(WRITING_PROBLEM_NOT_SUBMITTABLE_MESSAGE);
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
    ).rejects.toThrow(WRITING_PROBLEM_NOT_SUBMITTABLE_MESSAGE);
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

describe("createComparisonReportAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    helpers.getUserMock.mockResolvedValue({
      data: {
        user: { id: "user-1" },
      },
    });
    helpers.rpcMock.mockResolvedValue({
      data: "report-id",
      error: null,
    });
  });

  it("uses the latest previous complete submission when previous_id is omitted", async () => {
    mockComparisonStore({
      writing_submissions: [
        submissionRow({
          id: "current",
          char_count: 120,
          submitted_at: "2026-06-20T10:00:00.000Z",
        }),
        submissionRow({
          id: "other-problem-newer",
          problem_id: "problem-2",
          char_count: 110,
          submitted_at: "2026-06-19T12:00:00.000Z",
        }),
        submissionRow({
          id: "previous-latest",
          char_count: 90,
          submitted_at: "2026-06-19T10:00:00.000Z",
        }),
        submissionRow({
          id: "previous-older",
          submitted_at: "2026-06-18T10:00:00.000Z",
        }),
        submissionRow({
          id: "previous-incomplete",
          feedback_status: "analyzing",
          submitted_at: "2026-06-19T12:00:00.000Z",
        }),
      ],
      writing_feedback: [
        feedbackRow("current", 82),
        feedbackRow("previous-latest", 70),
      ],
      feedback_dimension_scores: [
        dimensionRow("current", 82),
        dimensionRow("previous-latest", 70),
      ],
    });

    const result = await createComparisonReportAction({
      current_id: "current",
    });

    expect(result).toEqual({ reportId: "report-id" });
    expect(helpers.rpcMock).toHaveBeenCalledWith(
      "create_comparison_report_with_metrics",
      expect.objectContaining({
        current_id: "current",
        previous_id: "previous-latest",
        metrics: expect.objectContaining({
          no_previous: false,
          score_delta: 12,
          char_delta: 30,
        }),
      }),
    );
  });

  it("rejects an explicit previous_id from a different problem", async () => {
    mockComparisonStore({
      writing_submissions: [
        submissionRow({
          id: "current",
          submitted_at: "2026-06-20T10:00:00.000Z",
        }),
        submissionRow({
          id: "different-problem",
          problem_id: "problem-2",
          submitted_at: "2026-06-19T10:00:00.000Z",
        }),
      ],
    });

    await expect(
      createComparisonReportAction({
        current_id: "current",
        previous_id: "different-problem",
      }),
    ).rejects.toThrow("same problem_id");

    expect(helpers.rpcMock).not.toHaveBeenCalled();
  });

  it("prefers parent_submission_id over the latest previous complete submission", async () => {
    mockComparisonStore({
      writing_submissions: [
        submissionRow({
          id: "current",
          parent_submission_id: "parent",
          submitted_at: "2026-06-20T10:00:00.000Z",
        }),
        submissionRow({
          id: "parent",
          submitted_at: "2026-06-18T10:00:00.000Z",
        }),
        submissionRow({
          id: "previous-latest",
          submitted_at: "2026-06-19T10:00:00.000Z",
        }),
      ],
      writing_feedback: [feedbackRow("current", 82), feedbackRow("parent", 74)],
      feedback_dimension_scores: [
        dimensionRow("current", 82),
        dimensionRow("parent", 74),
      ],
    });

    await createComparisonReportAction({ current_id: "current" });

    expect(helpers.rpcMock).toHaveBeenCalledWith(
      "create_comparison_report_with_metrics",
      expect.objectContaining({
        previous_id: "parent",
        metrics: expect.objectContaining({
          no_previous: false,
          score_delta: 8,
        }),
      }),
    );
  });

  it("ignores parent_submission_id when the parent belongs to a different problem", async () => {
    mockComparisonStore({
      writing_submissions: [
        submissionRow({
          id: "current",
          parent_submission_id: "parent-other-problem",
          submitted_at: "2026-06-20T10:00:00.000Z",
        }),
        submissionRow({
          id: "parent-other-problem",
          problem_id: "problem-2",
          submitted_at: "2026-06-18T10:00:00.000Z",
        }),
        submissionRow({
          id: "previous-same-problem",
          submitted_at: "2026-06-19T10:00:00.000Z",
        }),
      ],
      writing_feedback: [
        feedbackRow("current", 82),
        feedbackRow("previous-same-problem", 72),
      ],
      feedback_dimension_scores: [
        dimensionRow("current", 82),
        dimensionRow("previous-same-problem", 72),
      ],
    });

    await createComparisonReportAction({ current_id: "current" });

    expect(helpers.rpcMock).toHaveBeenCalledWith(
      "create_comparison_report_with_metrics",
      expect.objectContaining({
        previous_id: "previous-same-problem",
        metrics: expect.objectContaining({
          no_previous: false,
          score_delta: 10,
        }),
      }),
    );
  });

  it("keeps an owned parent submission as previous even when parent feedback is incomplete", async () => {
    mockComparisonStore({
      writing_submissions: [
        submissionRow({
          id: "current",
          parent_submission_id: "parent",
          char_count: 120,
          submitted_at: "2026-06-20T10:00:00.000Z",
        }),
        submissionRow({
          id: "parent",
          feedback_status: "analyzing",
          char_count: 80,
          submitted_at: "2026-06-18T10:00:00.000Z",
        }),
        submissionRow({
          id: "previous-latest",
          submitted_at: "2026-06-19T10:00:00.000Z",
        }),
      ],
      writing_feedback: [
        feedbackRow("current", 82),
        feedbackRow("previous-latest", 74),
      ],
      feedback_dimension_scores: [dimensionRow("current", 82)],
    });

    await createComparisonReportAction({ current_id: "current" });

    expect(helpers.rpcMock).toHaveBeenCalledWith(
      "create_comparison_report_with_metrics",
      expect.objectContaining({
        previous_id: "parent",
        metrics: expect.objectContaining({
          no_previous: false,
          score_delta: null,
          char_delta: 40,
        }),
      }),
    );
  });

  it("keeps no_previous=true when no previous complete submission exists", async () => {
    mockComparisonStore({
      writing_submissions: [
        submissionRow({
          id: "current",
          submitted_at: "2026-06-20T10:00:00.000Z",
        }),
        submissionRow({
          id: "previous-incomplete",
          feedback_status: "analyzing",
          submitted_at: "2026-06-19T10:00:00.000Z",
        }),
        submissionRow({
          id: "other-problem-complete",
          problem_id: "problem-2",
          submitted_at: "2026-06-19T12:00:00.000Z",
        }),
      ],
      writing_feedback: [feedbackRow("current", 82)],
      feedback_dimension_scores: [dimensionRow("current", 82)],
    });

    await createComparisonReportAction({ current_id: "current" });

    expect(helpers.rpcMock).toHaveBeenCalledWith(
      "create_comparison_report_with_metrics",
      expect.objectContaining({
        previous_id: null,
        metrics: expect.objectContaining({
          no_previous: true,
          score_delta: null,
          char_delta: null,
        }),
      }),
    );
  });

  it("creates a comparison report and returns its hydrated view model", async () => {
    mockComparisonStore({
      comparison_reports: [
        {
          id: "report-id",
          user_id: "user-1",
          current_submission_id: "current",
          previous_submission_id: "previous",
          metrics: {
            score_delta: 12,
            dimension_deltas: { grammar: 12 },
            char_delta: 30,
            no_previous: false,
          },
          narrative: "Hydrated comparison narrative",
          ai_model: "comparison-local-v2",
          generated_at: "2026-06-20T10:00:00.000Z",
        },
      ],
      writing_submissions: [
        submissionRow({
          id: "current",
          answer_text: "current answer",
          char_count: 120,
          submitted_at: "2026-06-20T10:00:00.000Z",
        }),
        submissionRow({
          id: "previous",
          answer_text: "previous answer",
          char_count: 90,
          submitted_at: "2026-06-19T10:00:00.000Z",
        }),
      ],
      writing_feedback: [
        feedbackRow("current", 82),
        feedbackRow("previous", 70),
      ],
      feedback_dimension_scores: [
        dimensionRow("current", 82),
        dimensionRow("previous", 70),
      ],
    });

    const result = await createComparisonReportWithViewAction({
      current_id: "current",
      previous_id: "previous",
    });

    expect(result.reportId).toBe("report-id");
    expect(result.viewModel.reportId).toBe("report-id");
    expect(result.viewModel.selectedPreviousSubmissionId).toBe("previous");
    expect(result.viewModel.previousText).toBe("previous answer");
    expect(result.viewModel.comparisonTargets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          submissionId: "previous",
          isSelected: true,
        }),
      ]),
    );
  });

  it("creates Q51 blank metrics from raw trait scores when dimension rows are empty", async () => {
    mockComparisonStore({
      writing_submissions: [
        submissionRow({
          id: "current",
          question_no: 51,
          answer_text: "ㄱ: 현재 답안\nㄴ: 현재 두 번째",
          answer_json: {
            _v: "51.v1",
            blanks: { ㄱ: "현재 답안", ㄴ: "현재 두 번째" },
          },
          char_count: 18,
          submitted_at: "2026-06-20T10:00:00.000Z",
        }),
        submissionRow({
          id: "previous",
          question_no: 51,
          answer_text: "ㄱ: 이전 답안\nㄴ: 이전 두 번째",
          answer_json: {
            _v: "51.v1",
            blanks: { ㄱ: "이전 답안", ㄴ: "이전 두 번째" },
          },
          char_count: 16,
          submitted_at: "2026-06-19T10:00:00.000Z",
        }),
      ],
      writing_feedback: [
        feedbackRow("current", 4, 10, {
          trait_scores: [
            { trait: "blank_1", score: 4, max_score: 5 },
            { trait: "blank_2", score: 2, max_score: 5 },
          ],
        }),
        feedbackRow("previous", 2, 10, {
          trait_scores: [
            { trait: "blank_1", score: 2, max_score: 5 },
            { trait: "blank_2", score: 2, max_score: 5 },
          ],
        }),
      ],
      feedback_dimension_scores: [],
    });

    await createComparisonReportAction({
      current_id: "current",
      previous_id: "previous",
    });

    expect(helpers.rpcMock).toHaveBeenCalledWith(
      "create_comparison_report_with_metrics",
      expect.objectContaining({
        previous_id: "previous",
        ai_model: "comparison-local-v2",
        metrics: expect.objectContaining({
          score_delta: 20,
          char_delta: 2,
          dimension_deltas: {
            blank_1: 40,
            blank_2: 0,
          },
        }),
        narrative: expect.stringContaining("ㄱ 빈칸 +40점"),
      }),
    );
  });
});
