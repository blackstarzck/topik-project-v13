import { describe, expect, it, vi } from "vitest";

import { fetchUserProblemsRpc } from "../../../src/components/practice/problem-list-data";

describe("fetchUserProblemsRpc", () => {
  it("maps writing-aware RPC rows and filter arguments", async () => {
    const rpc = vi.fn(async () => ({
      data: [
        {
          problem_id: "problem-54",
          title: "Essay problem",
          domain: "writing",
          topik_level: 2,
          question_no: 54,
          difficulty: 4,
          tags: null,
          attempt_count: null,
          is_solved: false,
          last_attempt_at: null,
          created_at: "2026-06-09T00:00:00.000Z",
          total_count: "7",
          solve_state: "attempted",
          has_draft: true,
          draft_status: "saved",
          writing_submission_count: 0,
          latest_submission_id: null,
          latest_submission_at: null,
          writing_feedback_status: null,
          lifecycle_status: "inactive",
          lifecycle_reason: "품질 점검 중",
          publish_status: "published",
          review_status: "approved",
        },
      ],
      error: null,
    }));

    const result = await fetchUserProblemsRpc(
      {
        filter: {
          questionNo: 54,
          difficulty: 4,
          topikLevel: 2,
          search: "  essay  ",
          solveStatus: "inProgress",
        },
        sort: "difficulty-desc",
        page: 2,
        pageSize: 20,
      },
      () => ({ rpc }) as never,
    );

    expect(rpc).toHaveBeenCalledWith("list_user_problems", {
      filter: {
        exclude_seed: true,
        question_no: 54,
        difficulty: 4,
        topik_level: 2,
        search: "essay",
        status: "attempted",
      },
      sort: "difficulty-desc",
      page: 2,
      page_size: 20,
    });
    expect(result.total).toBe(7);
    expect(result.rows[0]).toMatchObject({
      problemId: "problem-54",
      tags: [],
      solveState: "attempted",
      isSolved: false,
      latestSubmissionId: null,
      lifecycleStatus: "inactive",
      lifecycleReason: "품질 점검 중",
      publishStatus: "published",
      reviewStatus: "approved",
    });
  });

  it("passes recommended-only and exact sort intent to the RPC", async () => {
    const rpc = vi.fn(async () => ({
      data: [],
      error: null,
    }));

    await fetchUserProblemsRpc(
      {
        filter: {
          recommended: true,
        },
        sort: "oldest",
        page: 1,
        pageSize: 10,
      },
      () => ({ rpc }) as never,
    );

    expect(rpc).toHaveBeenCalledWith("list_user_problems", {
      filter: {
        exclude_seed: true,
        recommended: true,
      },
      sort: "oldest",
      page: 1,
      page_size: 10,
    });
  });

  it("passes saved review-set id to the RPC filter", async () => {
    const rpc = vi.fn(async () => ({
      data: [],
      error: null,
    }));

    await fetchUserProblemsRpc(
      {
        filter: {
          reviewSetId: "review-set-1",
        },
        sort: "newest",
        page: 1,
        pageSize: 10,
      },
      () => ({ rpc }) as never,
    );

    expect(rpc).toHaveBeenCalledWith("list_user_problems", {
      filter: {
        exclude_seed: true,
        review_set_id: "review-set-1",
      },
      sort: "newest",
      page: 1,
      page_size: 10,
    });
  });

  it("removes seed fixture rows from the user-facing problem list", async () => {
    const rpc = vi.fn(async () => ({
      data: [
        {
          problem_id: "seed-problem-51",
          title: "Seed fixture should not be visible",
          domain: "writing",
          topik_level: 2,
          question_no: 51,
          difficulty: 2,
          tags: ["seed:wireframe_problem_fixtures", "q51"],
          attempt_count: 0,
          is_solved: false,
          last_attempt_at: null,
          created_at: "2026-06-09T00:00:00.000Z",
          total_count: 2,
          solve_state: "none",
          latest_submission_id: null,
          lifecycle_status: "active",
          lifecycle_reason: null,
          publish_status: "published",
          review_status: "approved",
        },
        {
          problem_id: "real-problem-51",
          title: "External or curated problem",
          domain: "writing",
          topik_level: 2,
          question_no: 51,
          difficulty: 3,
          tags: ["grammar"],
          attempt_count: 0,
          is_solved: false,
          last_attempt_at: null,
          created_at: "2026-06-09T00:00:00.000Z",
          total_count: 2,
          solve_state: "none",
          latest_submission_id: null,
          lifecycle_status: "active",
          lifecycle_reason: null,
          publish_status: "published",
          review_status: "approved",
        },
      ],
      error: null,
    }));

    const result = await fetchUserProblemsRpc(
      {
        filter: {},
        sort: "newest",
        page: 1,
        pageSize: 10,
      },
      () => ({ rpc }) as never,
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].problemId).toBe("real-problem-51");
    expect(result.total).toBe(1);
  });

  it("falls back to legacy solved fields when solve_state is absent", async () => {
    const rpc = vi.fn(async () => ({
      data: [
        {
          problem_id: "problem-51",
          title: "Short answer",
          domain: "writing",
          topik_level: 1,
          question_no: 51,
          difficulty: 2,
          tags: ["51"],
          attempt_count: 1,
          is_solved: true,
          last_attempt_at: "2026-06-08T00:00:00.000Z",
          created_at: "2026-06-07T00:00:00.000Z",
          total_count: 1,
          latest_submission_id: "submission-1",
          lifecycle_status: "active",
          lifecycle_reason: null,
          publish_status: "published",
          review_status: "approved",
        },
      ],
      error: null,
    }));
    const from = vi.fn(() => ({
      select: vi.fn(() => ({
        in: vi.fn(async () => ({ data: [], error: null })),
      })),
    }));

    const result = await fetchUserProblemsRpc(
      {
        filter: {},
        sort: "newest",
        page: 1,
        pageSize: 10,
      },
      () => ({ rpc, from }) as never,
    );

    expect(result.rows[0]).toMatchObject({
      solveState: "submitted",
      isSolved: true,
      latestSubmissionId: "submission-1",
      lifecycleStatus: "active",
    });
  });

  it("preserves the latest writing feedback status for submitted rows", async () => {
    const rpc = vi.fn(async () => ({
      data: [
        {
          problem_id: "problem-pending-54",
          title: "Long answer waiting for analysis",
          domain: "writing",
          topik_level: 2,
          question_no: 54,
          difficulty: 4,
          tags: ["essay"],
          attempt_count: 1,
          is_solved: true,
          last_attempt_at: "2026-06-10T00:00:00.000Z",
          created_at: "2026-06-09T00:00:00.000Z",
          total_count: 1,
          solve_state: "submitted",
          latest_submission_id: "submission-analyzing-1",
          latest_submission_at: "2026-06-10T00:00:00.000Z",
          writing_feedback_status: "analyzing",
          lifecycle_status: "active",
          lifecycle_reason: null,
          publish_status: "published",
          review_status: "approved",
        },
      ],
      error: null,
    }));
    const from = vi.fn(() => ({
      select: vi.fn(() => ({
        in: vi.fn(async () => ({ data: [], error: null })),
      })),
    }));

    const result = await fetchUserProblemsRpc(
      {
        filter: {},
        sort: "newest",
        page: 1,
        pageSize: 10,
      },
      () => ({ rpc, from }) as never,
    );

    expect(result.rows[0]).toMatchObject({
      latestSubmissionId: "submission-analyzing-1",
      latestSubmissionAt: "2026-06-10T00:00:00.000Z",
      feedbackStatus: "analyzing",
    });
  });

  it("throws RPC errors", async () => {
    const error = new Error("rpc failed");
    const rpc = vi.fn(async () => ({ data: null, error }));

    await expect(
      fetchUserProblemsRpc(
        {
          filter: {},
          sort: "oldest",
          page: 1,
          pageSize: 10,
        },
        () => ({ rpc }) as never,
      ),
    ).rejects.toThrow("rpc failed");
  });
});
