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
  replaceStaleWritingDraftAction,
  submitWritingAction,
} from "../../../src/lib/writing/server-actions";
import { setWritingSubmissionControlForTests } from "../../../src/lib/writing/canonical-source";
import { WRITING_SUBMISSION_BLOCKED_MESSAGE } from "../../../src/lib/writing/submit-errors";

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

const CANONICAL_PROBLEM_ID = "00000000-0000-4000-8000-000000000001";
const SUBMISSION_INTENT_ID = "00000000-0000-4000-8000-000000000099";
const DRAFT_ID = "00000000-0000-4000-8000-0000000000dd";

function canonicalQuestionRow(overrides: Record<string, unknown> = {}) {
  return {
    problem_id: CANONICAL_PROBLEM_ID,
    question_id: "topik-writing-54-0001",
    canonical_import_id: 321,
    payload_hash: "payload-hash-321",
    item_number: 54,
    topik_level: 2,
    difficulty: 4,
    title: "환경 보호",
    prompt: "1) 필요성 2) 실천 방법 3) 사회의 역할",
    tags: ["환경"],
    materials: {
      prompt_questions: ["필요성", "실천 방법", "사회의 역할"],
      required_structure: ["도입", "본론", "결론"],
    },
    source_created_at: "2026-07-13T00:00:00.000Z",
    source_updated_at: "2026-07-13T00:00:00.000Z",
    ...overrides,
  };
}

function intentView(state: string, overrides: Record<string, unknown> = {}) {
  return {
    intent_id: SUBMISSION_INTENT_ID,
    state,
    should_dispatch: false,
    local_submission_id: null,
    external_submission_id: null,
    ...overrides,
  };
}

function canonicalSubmitInput(overrides: Record<string, unknown> = {}) {
  return {
    submission_intent_id: SUBMISSION_INTENT_ID,
    draft_id: DRAFT_ID,
    problem_id: CANONICAL_PROBLEM_ID,
    question_no: 54 as const,
    answer_text: "Canonical answer",
    char_count: 16,
    canonical_question_id: "topik-writing-54-0001",
    canonical_import_id: "321",
    canonical_payload_hash: "payload-hash-321",
    ...overrides,
  };
}

function mockSubmitTables(
  question = canonicalQuestionRow(),
  uiLocale: unknown = "ko",
) {
  helpers.fromMock.mockImplementation((table: string) => {
    const row =
      table === "writing_drafts"
        ? {
            id: DRAFT_ID,
            canonical_question_id: question.question_id,
            canonical_import_id: question.canonical_import_id,
            canonical_payload_hash: question.payload_hash,
            question_snapshot: {
              question_id: question.question_id,
              canonical_import_id: String(question.canonical_import_id),
              payload_hash: question.payload_hash,
              item_number: question.item_number,
              topik_level: question.topik_level,
              difficulty: question.difficulty,
              title: question.title,
              prompt: question.prompt,
              tags: question.tags,
              materials: question.materials,
            },
          }
        : { status: "active", ui_locale: uiLocale };
    const query = {
      eq: vi.fn(() => query),
      maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
    };
    return { select: vi.fn(() => query) };
  });
}

describe("submitWritingAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    helpers.getUserMock.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });
    helpers.getSessionMock.mockResolvedValue({
      data: { session: { access_token: "learner-token" } },
    });
    mockSubmitTables();
    helpers.rpcMock.mockResolvedValue({
      data: [canonicalQuestionRow()],
      error: null,
    });
    helpers.serviceRpcMock.mockImplementation(async (name: string) => {
      if (name === "prepare_writing_submission_intent") {
        return { data: intentView("pending"), error: null };
      }
      if (name === "claim_writing_submission_intent") {
        return {
          data: intentView("dispatching", { should_dispatch: true }),
          error: null,
        };
      }
      if (name === "materialize_writing_submission_intent") {
        return { data: SUBMISSION_INTENT_ID, error: null };
      }
      return { data: null, error: null };
    });
    helpers.createServiceClientMock.mockReturnValue({
      rpc: helpers.serviceRpcMock,
    });
    process.env.TALKPIK_API_BASE_URL = "https://api.example.test";
    delete process.env.E2E_DISABLE_EXTERNAL_WRITING_API;
    setWritingSubmissionControlForTests(null);
  });

  it("replaces a stale draft through the authenticated atomic RPC", async () => {
    helpers.rpcMock.mockResolvedValue({
      data: "00000000-0000-4000-8000-0000000000dd",
      error: null,
    });

    await expect(
      replaceStaleWritingDraftAction({
        draftId: "00000000-0000-4000-8000-0000000000dd",
        questionId: "topik-writing-54-0001",
        importId: "321",
        payloadHash: "payload-hash-321",
      }),
    ).resolves.toEqual({
      draftId: "00000000-0000-4000-8000-0000000000dd",
    });
  });

  it("blocks submission until local outbox evidence is verified", async () => {
    setWritingSubmissionControlForTests({
      submissionMode: "blocked",
      submissionContractState: "unverified",
    });

    await expect(submitWritingAction(canonicalSubmitInput())).resolves.toEqual({
      rejection: {
        code: "writing_submission_temporarily_blocked",
        message: WRITING_SUBMISSION_BLOCKED_MESSAGE,
      },
    });
    expect(helpers.serviceRpcMock).not.toHaveBeenCalled();
  });

  it("persists the canonical intent before sending the provider request", async () => {
    setWritingSubmissionControlForTests({
      submissionMode: "canonical",
      submissionContractState: "local_outbox_verified",
    });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          submission_id: "provider-string-id",
          status: "processing",
          message: "accepted",
        }),
        { status: 202 },
      ),
    );

    await expect(
      submitWritingAction(
        canonicalSubmitInput({
          passage_context: "client-controlled prompt",
        }),
      ),
    ).resolves.toEqual({
      submissionId: SUBMISSION_INTENT_ID,
      questionNo: 54,
    });

    expect(helpers.serviceRpcMock.mock.calls.map(([name]) => name)).toEqual([
      "prepare_writing_submission_intent",
      "claim_writing_submission_intent",
      "mark_writing_submission_intent_accepted",
      "materialize_writing_submission_intent",
    ]);
    expect(helpers.serviceRpcMock).toHaveBeenCalledWith(
      "prepare_writing_submission_intent",
      expect.objectContaining({
        p_intent_id: SUBMISSION_INTENT_ID,
        p_submission: expect.objectContaining({
          problem_id: CANONICAL_PROBLEM_ID,
          canonical_question_id: "topik-writing-54-0001",
          canonical_import_id: "321",
          canonical_payload_hash: "payload-hash-321",
          question_snapshot: expect.objectContaining({
            question_id: "topik-writing-54-0001",
            canonical_import_id: "321",
            payload_hash: "payload-hash-321",
          }),
        }),
      }),
    );
    expect(helpers.serviceRpcMock).toHaveBeenCalledWith(
      "mark_writing_submission_intent_accepted",
      expect.objectContaining({
        p_external_submission_id: "provider-string-id",
      }),
    );
    const providerBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(providerBody.question_id).toBe("topik-writing-54-0001");
    expect(providerBody).not.toHaveProperty("passage_context");
  });

  it("rejects a changed version before creating an outbox intent", async () => {
    setWritingSubmissionControlForTests({
      submissionMode: "canonical",
      submissionContractState: "local_outbox_verified",
    });
    helpers.rpcMock.mockResolvedValue({
      data: [
        canonicalQuestionRow({
          canonical_import_id: 322,
          payload_hash: "payload-hash-322",
        }),
      ],
      error: null,
    });
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(submitWritingAction(canonicalSubmitInput())).rejects.toThrow(
      "canonical_question_version_conflict",
    );
    expect(helpers.serviceRpcMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires a stable client-generated intent id", async () => {
    setWritingSubmissionControlForTests({
      submissionMode: "canonical",
      submissionContractState: "local_outbox_verified",
    });

    await expect(
      submitWritingAction(
        canonicalSubmitInput({ submission_intent_id: undefined }),
      ),
    ).rejects.toThrow("writing_submission_intent_id_required");
    expect(helpers.serviceRpcMock).not.toHaveBeenCalled();
  });

  it("requires a persisted owned draft before provider dispatch", async () => {
    setWritingSubmissionControlForTests({
      submissionMode: "canonical",
      submissionContractState: "local_outbox_verified",
    });

    await expect(
      submitWritingAction(canonicalSubmitInput({ draft_id: null })),
    ).rejects.toThrow("writing_submission_draft_required");
    expect(helpers.serviceRpcMock).not.toHaveBeenCalled();
  });

  it.each(["ko", "en", "vi"] as const)(
    "submits Q51 with the selected %s locale through the provider text contract",
    async (locale) => {
      setWritingSubmissionControlForTests({
        submissionMode: "canonical",
        submissionContractState: "local_outbox_verified",
      });
      const q51Question = canonicalQuestionRow({
        question_id: "topik-writing-51-0001",
        item_number: 51,
      });
      helpers.rpcMock.mockResolvedValue({
        data: [q51Question],
        error: null,
      });
      mockSubmitTables(q51Question, locale);
      const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            submission_id: "provider-q51-id",
            status: "processing",
            message: "accepted",
          }),
          { status: 202 },
        ),
      );

      await submitWritingAction(
        canonicalSubmitInput({
          question_no: 51,
          canonical_question_id: "topik-writing-51-0001",
          answer_json: { blanks: { ㄱ: "첫째", ㄴ: "둘째" } },
        }),
      );

      const providerBody = JSON.parse(
        String(fetchMock.mock.calls[0]?.[1]?.body),
      );
      expect(providerBody).toMatchObject({
        task_type: "Q51",
        text: "Canonical answer",
        lang: locale,
      });
      expect(providerBody).not.toHaveProperty("blanks");
    },
  );

  it.each([null, undefined, "fr"])(
    "falls back to Korean when the profile locale is %s",
    async (uiLocale) => {
      setWritingSubmissionControlForTests({
        submissionMode: "canonical",
        submissionContractState: "local_outbox_verified",
      });
      const q51Question = canonicalQuestionRow({
        question_id: "topik-writing-51-0001",
        item_number: 51,
      });
      helpers.rpcMock.mockResolvedValue({
        data: [q51Question],
        error: null,
      });
      mockSubmitTables(q51Question, uiLocale);
      const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            submission_id: "provider-q51-id",
            status: "processing",
            message: "accepted",
          }),
          { status: 202 },
        ),
      );

      await submitWritingAction(
        canonicalSubmitInput({
          question_no: 51,
          canonical_question_id: "topik-writing-51-0001",
          answer_json: { blanks: { ㄱ: "첫째", ㄴ: "둘째" } },
        }),
      );

      const providerBody = JSON.parse(
        String(fetchMock.mock.calls[0]?.[1]?.body),
      );
      expect(providerBody.lang).toBe("ko");
    },
  );
});

describe("createComparisonReportAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    helpers.getUserMock.mockResolvedValue({
      data: {
        user: { id: "user-1" },
      },
    });
    helpers.rpcMock.mockImplementation(async (name: string) =>
      name === "get_my_account_state"
        ? { data: "active", error: null }
        : { data: "report-id", error: null },
    );
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

    expect(helpers.rpcMock).not.toHaveBeenCalledWith(
      "create_comparison_report_with_metrics",
      expect.anything(),
    );
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
