import { beforeEach, describe, expect, it, vi } from "vitest";

const helpers = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  getSessionMock: vi.fn(),
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
  getExternalEvaluationStatusMock: vi.fn(),
  getExternalEvaluationFeedbackMock: vi.fn(),
  mapExternalEvaluationFeedbackMock: vi.fn(),
  serviceRpcMock: vi.fn(),
  createServiceClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () =>
    Promise.resolve({
      auth: {
        getUser: helpers.getUserMock,
        getSession: helpers.getSessionMock,
      },
      from: helpers.fromMock,
      rpc: helpers.rpcMock,
    }),
}));

vi.mock("@/lib/supabase/service-role.server", () => ({
  createSupabaseServiceRoleClient: helpers.createServiceClientMock,
}));

vi.mock("@/lib/writing-api/evaluation", () => ({
  getTalkpikApiBaseUrl: () => process.env.TALKPIK_API_BASE_URL?.trim() ?? null,
  getExternalEvaluationStatus: helpers.getExternalEvaluationStatusMock,
  getExternalEvaluationFeedback: helpers.getExternalEvaluationFeedbackMock,
  mapExternalEvaluationFeedback: helpers.mapExternalEvaluationFeedbackMock,
}));

import { GET } from "../../../../src/app/api/writing/evaluation-status/route";

const LOCAL_SUBMISSION_ID = "00000000-0000-0000-0000-000000000099";
const EXTERNAL_SUBMISSION_ID = "provider-writing-2026-000099";

describe("GET /api/writing/evaluation-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TALKPIK_API_BASE_URL = "https://api.example.test";
    helpers.getUserMock.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "student@example.com",
          email_confirmed_at: "2026-06-29T00:00:00.000Z",
        },
      },
    });
    helpers.getSessionMock.mockResolvedValue({
      data: { session: { access_token: "learner-token" } },
    });
    helpers.fromMock.mockImplementation((table: string) => {
      // 상태 게이트는 호출자 본인만 반환하는 최소 상태 RPC를 사용한다.
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: { status: "active" }, error: null }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: {
                  id: LOCAL_SUBMISSION_ID,
                  external_submission_id: EXTERNAL_SUBMISSION_ID,
                  user_id: "user-1",
                  feedback_status: "analyzing",
                },
                error: null,
              }),
          }),
        }),
      };
    });
    helpers.rpcMock.mockImplementation(async (name: string) =>
      name === "get_my_account_state"
        ? { data: "active", error: null }
        : { data: "complete", error: null },
    );
    helpers.serviceRpcMock.mockResolvedValue({ data: "complete", error: null });
    helpers.createServiceClientMock.mockReturnValue({
      rpc: helpers.serviceRpcMock,
    });
  });

  it("syncs externally graded feedback through the feedback RPC", async () => {
    helpers.getExternalEvaluationStatusMock.mockResolvedValue({
      submission_id: EXTERNAL_SUBMISSION_ID,
      status: "graded",
    });
    const externalFeedback = {
      submission_id: EXTERNAL_SUBMISSION_ID,
      status: "graded",
      trait_scores: [
        { trait: "blank_1", score: 4, max_score: 5 },
        { trait: "blank_2", score: 4, max_score: 5 },
      ],
      annotations: [
        { original_text: "정리하지 않으면" },
        { original_text: "꼼꼼하게" },
        { original_text: "좋다" },
      ],
    };
    helpers.getExternalEvaluationFeedbackMock.mockResolvedValue(
      externalFeedback,
    );
    helpers.mapExternalEvaluationFeedbackMock.mockReturnValue({
      feedback: {
        status: "complete",
        score_total: 9,
        score_max: 10,
        overall_summary: "Good",
        ai_model: "talkpik-writing-api",
        ai_model_version: "openapi",
      },
      dimensions: [{ dimension: "grammar", score: 9, score_max: 10 }],
      sentences: [
        { sentence_index: 0, original_text: "A", corrected_text: "B" },
        { sentence_index: 1, original_text: "C", corrected_text: "D" },
        { sentence_index: 2, original_text: "E", corrected_text: "F" },
      ],
    });

    const response = await GET(
      new Request(
        "http://localhost/api/writing/evaluation-status?submissionId=00000000-0000-0000-0000-000000000099",
      ),
    );

    await expect(response.json()).resolves.toEqual({
      feedback_status: "complete",
    });
    expect(helpers.getExternalEvaluationStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({ submissionId: EXTERNAL_SUBMISSION_ID }),
    );
    expect(helpers.getExternalEvaluationFeedbackMock).toHaveBeenCalledWith(
      expect.objectContaining({ submissionId: EXTERNAL_SUBMISSION_ID }),
    );
    expect(helpers.rpcMock).not.toHaveBeenCalledWith(
      "sync_external_writing_feedback",
      expect.anything(),
    );
    expect(helpers.serviceRpcMock).toHaveBeenCalledWith(
      "sync_external_writing_feedback",
      {
        target_submission_id: LOCAL_SUBMISSION_ID,
        next_status: "complete",
        feedback: expect.objectContaining({
          status: "complete",
          raw_ai_result: externalFeedback,
        }),
        dimensions: [{ dimension: "grammar", score: 9, score_max: 10 }],
        sentences: [
          { sentence_index: 0, original_text: "A", corrected_text: "B" },
          { sentence_index: 1, original_text: "C", corrected_text: "D" },
          { sentence_index: 2, original_text: "E", corrected_text: "F" },
        ],
      },
    );
  });

  it("rejects email-unverified sessions before reading user data", async () => {
    helpers.getUserMock.mockResolvedValueOnce({
      data: {
        user: {
          id: "user-1",
          email: "student@example.com",
          email_confirmed_at: null,
        },
      },
    });

    const response = await GET(
      new Request(
        "http://localhost/api/writing/evaluation-status?submissionId=00000000-0000-0000-0000-000000000099",
      ),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "email_unverified",
    });
    expect(helpers.fromMock).not.toHaveBeenCalled();
  });

  it("does not sync feedback when the external status id does not match the local submission", async () => {
    helpers.getExternalEvaluationStatusMock.mockResolvedValue({
      submission_id: "different-provider-id",
      status: "graded",
    });

    const response = await GET(
      new Request(
        "http://localhost/api/writing/evaluation-status?submissionId=00000000-0000-0000-0000-000000000099",
      ),
    );

    await expect(response.json()).resolves.toEqual({
      feedback_status: "analyzing",
    });
    expect(helpers.getExternalEvaluationFeedbackMock).not.toHaveBeenCalled();
    expect(helpers.serviceRpcMock).not.toHaveBeenCalled();
  });

  it("does not sync feedback when the external feedback id does not match the local submission", async () => {
    helpers.getExternalEvaluationStatusMock.mockResolvedValue({
      submission_id: EXTERNAL_SUBMISSION_ID,
      status: "graded",
    });
    helpers.getExternalEvaluationFeedbackMock.mockResolvedValue({
      submission_id: "different-provider-id",
      status: "graded",
    });
    helpers.mapExternalEvaluationFeedbackMock.mockReturnValue({
      feedback: {
        status: "complete",
        score_total: 9,
        score_max: 10,
        overall_summary: "Good",
        ai_model: "talkpik-writing-api",
        ai_model_version: "openapi",
      },
      dimensions: [],
      sentences: [],
    });

    const response = await GET(
      new Request(
        "http://localhost/api/writing/evaluation-status?submissionId=00000000-0000-0000-0000-000000000099",
      ),
    );

    await expect(response.json()).resolves.toEqual({
      feedback_status: "analyzing",
    });
    expect(helpers.serviceRpcMock).not.toHaveBeenCalled();
  });

  it("reports a status check error without marking the submission failed when external status lookup fails", async () => {
    helpers.getExternalEvaluationStatusMock.mockRejectedValueOnce(
      new Error("upstream unavailable"),
    );

    const response = await GET(
      new Request(
        "http://localhost/api/writing/evaluation-status?submissionId=00000000-0000-0000-0000-000000000099",
      ),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      feedback_status: "analyzing",
      error: "status_check_failed",
    });
    expect(helpers.serviceRpcMock).not.toHaveBeenCalled();
  });

  it("reports a status check error without marking the submission failed when feedback sync fails", async () => {
    helpers.getExternalEvaluationStatusMock.mockResolvedValue({
      submission_id: EXTERNAL_SUBMISSION_ID,
      status: "graded",
    });
    helpers.getExternalEvaluationFeedbackMock.mockResolvedValue({
      submission_id: EXTERNAL_SUBMISSION_ID,
      status: "graded",
    });
    helpers.mapExternalEvaluationFeedbackMock.mockReturnValue({
      feedback: {
        status: "complete",
        score_total: 9,
        score_max: 10,
        overall_summary: "Good",
        ai_model: "talkpik-writing-api",
        ai_model_version: "openapi",
      },
      dimensions: [],
      sentences: [],
    });
    helpers.serviceRpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "illegal feedback_status transition" },
    });

    const response = await GET(
      new Request(
        "http://localhost/api/writing/evaluation-status?submissionId=00000000-0000-0000-0000-000000000099",
      ),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      feedback_status: "analyzing",
      error: "status_check_failed",
    });
  });
});
