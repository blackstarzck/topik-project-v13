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
  createSupabaseServiceRoleClient: helpers.createServiceClientMock,
}));

vi.mock("@/lib/writing-api/evaluation", () => ({
  getTalkpikApiBaseUrl: () => process.env.TALKPIK_API_BASE_URL?.trim() ?? null,
  getExternalEvaluationStatus: helpers.getExternalEvaluationStatusMock,
  getExternalEvaluationFeedback: helpers.getExternalEvaluationFeedbackMock,
  mapExternalEvaluationFeedback: helpers.mapExternalEvaluationFeedbackMock,
}));

import { GET } from "../../../../src/app/api/writing/evaluation-status/route";

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
      // 새 status 게이트: fetchProfileStatus(supabase, userId) 는 profiles 를 조회한다.
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
                  id: "00000000-0000-0000-0000-000000000099",
                  user_id: "user-1",
                  feedback_status: "analyzing",
                },
                error: null,
              }),
          }),
        }),
      };
    });
    helpers.rpcMock.mockResolvedValue({ data: "complete", error: null });
    helpers.serviceRpcMock.mockResolvedValue({ data: "complete", error: null });
    helpers.createServiceClientMock.mockReturnValue({
      rpc: helpers.serviceRpcMock,
    });
  });

  it("syncs externally graded feedback through the feedback RPC", async () => {
    helpers.getExternalEvaluationStatusMock.mockResolvedValue({
      submission_id: "00000000-0000-0000-0000-000000000099",
      status: "graded",
    });
    const externalFeedback = {
      submission_id: "00000000-0000-0000-0000-000000000099",
      status: "graded",
    };
    helpers.getExternalEvaluationFeedbackMock.mockResolvedValue(externalFeedback);
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
      sentences: [{ sentence_index: 0, original_text: "A", corrected_text: "B" }],
    });

    const response = await GET(
      new Request(
        "http://localhost/api/writing/evaluation-status?submissionId=00000000-0000-0000-0000-000000000099",
      ),
    );

    await expect(response.json()).resolves.toEqual({ feedback_status: "complete" });
    expect(helpers.rpcMock).not.toHaveBeenCalledWith(
      "sync_external_writing_feedback",
      expect.anything(),
    );
    expect(helpers.serviceRpcMock).toHaveBeenCalledWith(
      "sync_external_writing_feedback",
      {
        target_submission_id: "00000000-0000-0000-0000-000000000099",
        next_status: "complete",
        feedback: expect.objectContaining({
          status: "complete",
          raw_ai_result: externalFeedback,
        }),
        dimensions: [{ dimension: "grammar", score: 9, score_max: 10 }],
        sentences: [{ sentence_index: 0, original_text: "A", corrected_text: "B" }],
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
      submission_id: "00000000-0000-0000-0000-000000000000",
      status: "graded",
    });

    const response = await GET(
      new Request(
        "http://localhost/api/writing/evaluation-status?submissionId=00000000-0000-0000-0000-000000000099",
      ),
    );

    await expect(response.json()).resolves.toEqual({ feedback_status: "analyzing" });
    expect(helpers.getExternalEvaluationFeedbackMock).not.toHaveBeenCalled();
    expect(helpers.serviceRpcMock).not.toHaveBeenCalled();
  });

  it("does not sync feedback when the external feedback id does not match the local submission", async () => {
    helpers.getExternalEvaluationStatusMock.mockResolvedValue({
      submission_id: "00000000-0000-0000-0000-000000000099",
      status: "graded",
    });
    helpers.getExternalEvaluationFeedbackMock.mockResolvedValue({
      submission_id: "00000000-0000-0000-0000-000000000000",
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

    await expect(response.json()).resolves.toEqual({ feedback_status: "analyzing" });
    expect(helpers.serviceRpcMock).not.toHaveBeenCalled();
  });
});
