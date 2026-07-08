import { describe, expect, it } from "vitest";

import {
  getComparisonTargetCandidates,
  getNextWritingProblemStartHref,
  getRetrySubmissionSeed,
  getWritingProblem,
  getWritingProblemAvailability,
} from "../../../src/lib/writing/server";
import type {
  WritingFeedbackRow,
  WritingSubmissionRow,
} from "../../../src/lib/writing/types";

type QueryRow = {
  id: string;
  title: string;
  prompt: string;
  question_no: number | null;
  tags?: string[] | null;
  materials: unknown;
  answer_key: unknown;
  rubric: unknown;
  lifecycle_status?: "active" | "inactive" | "expired" | null;
  lifecycle_reason?: string | null;
};

type Call =
  | { type: "from"; table: string }
  | { type: "select"; table: string; columns: string }
  | { type: "eq"; column: string; value: unknown }
  | { type: "neq"; column: string; value: unknown }
  | { type: "in"; column: string; values: unknown[] }
  | { type: "limit"; count: number }
  | { type: "order"; column: string }
  | { type: "range"; from: number; to: number };

type NextProblemRow = {
  id: string;
  domain: string;
  question_no: number | null;
  publish_status: string | null;
  lifecycle_status: string | null;
  tags?: string[] | null;
  materials?: unknown;
};

type NextProblemCall =
  | { type: "from"; table: string }
  | { type: "select"; columns: string }
  | { type: "eq"; column: string; value: unknown }
  | { type: "gt"; column: string; value: unknown }
  | { type: "order"; column: string }
  | { type: "limit"; count: number }
  | { type: "rpc"; name: string; args: Record<string, unknown> };

// 실제 problems.id는 uuid — getWritingProblem의 D-3 uuid 형식 가드를 통과해야
// 하므로 fixture id도 uuid 형식을 쓴다 (이전 "incomplete-51" 류 문자열은 가드에
// 걸려 explicit-id 케이스가 무의미해진다).
const INCOMPLETE_51_ID = "11111111-1111-4111-8111-111111111151";
const COMPLETE_51_ID = "22222222-2222-4222-8222-222222222251";
const UNTOUCHED_51_ID = "44444444-4444-4444-8444-444444444451";

const incomplete51: QueryRow = {
  id: INCOMPLETE_51_ID,
  title: "Incomplete 51",
  prompt: "Prompt without blank markers or blank metadata.",
  question_no: 51,
  materials: {},
  answer_key: {},
  rubric: {},
  lifecycle_status: "active",
  lifecycle_reason: null,
};

const complete51: QueryRow = {
  id: COMPLETE_51_ID,
  title: "Complete 51",
  prompt: "Prompt whose blanks are represented in materials.",
  question_no: 51,
  materials: {
    blanks: {
      blank_target_giyeok: "first blank target",
      blank_target_nieun: "second blank target",
    },
  },
  answer_key: {},
  rubric: {},
  lifecycle_status: "active",
  lifecycle_reason: null,
};

function complete51Problem(id: string, title = `Complete ${id}`): QueryRow {
  return {
    ...complete51,
    id,
    title,
  };
}

function uuidFor51(index: number): string {
  return `${index.toString(16).padStart(8, "0")}-5151-4000-8000-${index
    .toString()
    .padStart(12, "0")}`;
}

const SEED_51_ID = "33333333-3333-4333-8333-333333333351";

const seed51: QueryRow = {
  id: SEED_51_ID,
  title: "Seed 51",
  prompt: "Wireframe fixture prompt.",
  question_no: 51,
  tags: ["seed:wireframe_problem_fixtures", "q51"],
  materials: {
    seed_source: "wireframe_problem_fixtures",
    blanks: {
      blank_target_giyeok: "first blank target",
      blank_target_nieun: "second blank target",
    },
  },
  answer_key: {},
  rubric: {},
  lifecycle_status: "active",
  lifecycle_reason: null,
};

type WritingSubmissionHistoryRow = {
  user_id: string;
  problem_id: string;
  feedback_status?: string | null;
};

type WritingDraftHistoryRow = {
  user_id: string;
  problem_id: string;
  autosave_status?: string | null;
};

type MakeClientInput =
  | QueryRow[]
  | {
      problems: QueryRow[];
      writingSubmissions?: WritingSubmissionHistoryRow[];
      writingDrafts?: WritingDraftHistoryRow[];
      visibleProblemIds?: string[];
    };

function makeClient(input: MakeClientInput) {
  const rows = Array.isArray(input) ? input : input.problems;
  const writingSubmissions = Array.isArray(input)
    ? []
    : (input.writingSubmissions ?? []);
  const writingDrafts = Array.isArray(input) ? [] : (input.writingDrafts ?? []);
  const visibleProblemIds = Array.isArray(input)
    ? rows.map((row) => row.id)
    : (input.visibleProblemIds ?? rows.map((row) => row.id));
  const calls: Call[] = [];
  const client = {
    rpc: async () => ({
      data: visibleProblemIds.map((problem_id) => ({ problem_id })),
      error: null,
    }),
    from: (table: string) => {
      calls.push({ type: "from", table });
      const filters: Array<{ column: string; value: unknown }> = [];
      const neqFilters: Array<{ column: string; value: unknown }> = [];
      const inFilters: Array<{ column: string; values: unknown[] }> = [];
      let limitCount: number | null = null;

      const applyProblemFilters = () =>
        rows.filter((row) =>
          filters.every((filter) => {
            if (!(filter.column in row)) return true;
            return row[filter.column as keyof QueryRow] === filter.value;
          }),
        );

      const applyHistoryFilters = <
        T extends WritingSubmissionHistoryRow | WritingDraftHistoryRow,
      >(
        historyRows: T[],
      ) =>
        historyRows
          .filter((row) =>
            filters.every(
              (filter) => row[filter.column as keyof T] === filter.value,
            ),
          )
          .filter((row) =>
            neqFilters.every(
              (filter) => row[filter.column as keyof T] !== filter.value,
            ),
          )
          .filter((row) =>
            inFilters.every((filter) =>
              filter.values.includes(row[filter.column as keyof T]),
            ),
          );

      const resolveData = () => {
        if (table === "writing_submissions") {
          return applyHistoryFilters(writingSubmissions);
        }
        if (table === "writing_drafts") {
          return applyHistoryFilters(writingDrafts);
        }
        const data = applyProblemFilters();
        return limitCount == null ? data : data.slice(0, limitCount);
      };

      const query = {
        select: (columns: string) => {
          calls.push({ type: "select", table, columns });
          return query;
        },
        eq: (column: string, value: unknown) => {
          calls.push({ type: "eq", column, value });
          filters.push({ column, value });
          return query;
        },
        neq: (column: string, value: unknown) => {
          calls.push({ type: "neq", column, value });
          neqFilters.push({ column, value });
          return query;
        },
        in: (column: string, values: unknown[]) => {
          calls.push({ type: "in", column, values });
          inFilters.push({ column, values });
          return query;
        },
        order: (column: string) => {
          calls.push({ type: "order", column });
          return query;
        },
        limit: (count: number) => {
          calls.push({ type: "limit", count });
          limitCount = count;
          return query;
        },
        range: (from: number, to: number) => {
          calls.push({ type: "range", from, to });
          const data = applyProblemFilters().slice(from, to + 1);
          return Promise.resolve({ data, error: null });
        },
        then: (
          resolve: (value: {
            data: Array<
              QueryRow | WritingSubmissionHistoryRow | WritingDraftHistoryRow
            >;
            error: null;
          }) => unknown,
          reject?: (reason: unknown) => unknown,
        ) => {
          const data = resolveData();
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  return { client, calls };
}

function makeAvailabilityClient(
  row: {
    publish_status: string | null;
    visibility: string | null;
    lifecycle_status: string | null;
    lifecycle_reason: string | null;
    question_no: number | null;
  } | null,
  visible = true,
) {
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      return Promise.resolve({ data: visible, error: null });
    },
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: () => Promise.resolve({ data: row, error: null }),
      };
      return query;
    },
  };
  return { client, rpcCalls };
}

function makeNextProblemClient(
  rows: NextProblemRow[],
  visibleProblemIds = rows.map((row) => row.id),
) {
  const calls: NextProblemCall[] = [];
  const client = {
    rpc: (name: string, args: Record<string, unknown>) => {
      calls.push({ type: "rpc", name, args });
      return Promise.resolve({
        data: visibleProblemIds.map((problem_id) => ({ problem_id })),
        error: null,
      });
    },
    from: (table: string) => {
      calls.push({ type: "from", table });
      const filters: Array<{ column: string; value: unknown }> = [];
      const greaterThanFilters: Array<{ column: string; value: unknown }> = [];
      let limitCount: number | null = null;
      const query = {
        select: (columns: string) => {
          calls.push({ type: "select", columns });
          return query;
        },
        eq: (column: string, value: unknown) => {
          filters.push({ column, value });
          calls.push({ type: "eq", column, value });
          return query;
        },
        gt: (column: string, value: unknown) => {
          greaterThanFilters.push({ column, value });
          calls.push({ type: "gt", column, value });
          return query;
        },
        order: (column: string) => {
          calls.push({ type: "order", column });
          return query;
        },
        limit: (count: number) => {
          calls.push({ type: "limit", count });
          limitCount = count;
          return query;
        },
        then: (
          resolve: (value: { data: NextProblemRow[]; error: null }) => unknown,
          reject?: (reason: unknown) => unknown,
        ) => {
          const data = rows
            .filter((row) =>
              filters.every(
                (filter) =>
                  row[filter.column as keyof NextProblemRow] === filter.value,
              ),
            )
            .filter((row) =>
              greaterThanFilters.every((filter) => {
                const rowValue = row[filter.column as keyof NextProblemRow];
                return (
                  typeof rowValue === "string" &&
                  typeof filter.value === "string" &&
                  rowValue.localeCompare(filter.value) > 0
                );
              }),
            )
            .sort((a, b) => a.id.localeCompare(b.id))
            .slice(0, limitCount ?? undefined);
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  return { client, calls };
}

function makeRetrySeedClient(rows: WritingSubmissionRow[]) {
  const client = {
    from: () => {
      const filters: Array<{ column: string; value: unknown }> = [];
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => {
          filters.push({ column, value });
          return query;
        },
        maybeSingle: () =>
          Promise.resolve({
            data:
              rows.find((row) =>
                filters.every(
                  (filter) =>
                    row[filter.column as keyof WritingSubmissionRow] ===
                    filter.value,
                ),
              ) ?? null,
            error: null,
          }),
      };
      return query;
    },
  };
  return client;
}

function submissionRow(
  overrides: Partial<WritingSubmissionRow> & { id: string },
): WritingSubmissionRow {
  return {
    id: overrides.id,
    user_id: overrides.user_id ?? "user-1",
    problem_id: overrides.problem_id ?? "problem-54",
    draft_id: null,
    question_no: overrides.question_no ?? 54,
    answer_text: overrides.answer_text ?? "answer",
    answer_json: overrides.answer_json ?? null,
    char_count: overrides.char_count ?? 100,
    submitted_at: overrides.submitted_at ?? "2026-06-20T10:00:00.000Z",
    feedback_status: overrides.feedback_status ?? "complete",
    parent_submission_id: overrides.parent_submission_id ?? null,
  };
}

function feedbackRow(
  submissionId: string,
  score: number | null,
  status: WritingFeedbackRow["status"] = "complete",
): WritingFeedbackRow {
  return {
    submission_id: submissionId,
    user_id: "user-1",
    status,
    score_total: score,
    score_max: 100,
    overall_summary: null,
    ai_model: null,
    ai_model_version: null,
    raw_ai_result: null,
    generated_at: "2026-06-20T10:00:00.000Z",
  };
}

function makeComparisonClient(
  submissions: WritingSubmissionRow[],
  feedback: WritingFeedbackRow[],
) {
  const client = {
    from: (table: string) => {
      if (table === "writing_feedback") {
        const query = {
          select: () => query,
          in: (column: string, values: string[]) => {
            expect(column).toBe("submission_id");
            return Promise.resolve({
              data: feedback.filter((row) =>
                values.includes(row.submission_id),
              ),
              error: null,
            });
          },
        };
        return query;
      }

      const filters: Array<{ column: string; value: unknown }> = [];
      const neqFilters: Array<{ column: string; value: unknown }> = [];
      let submittedBefore: string | null = null;

      const applyFilters = () =>
        submissions
          .filter((row) =>
            filters.every(
              (filter) =>
                row[filter.column as keyof WritingSubmissionRow] ===
                filter.value,
            ),
          )
          .filter((row) =>
            neqFilters.every(
              (filter) =>
                row[filter.column as keyof WritingSubmissionRow] !==
                filter.value,
            ),
          )
          .filter((row) =>
            submittedBefore ? row.submitted_at < submittedBefore : true,
          )
          .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));

      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => {
          filters.push({ column, value });
          return query;
        },
        neq: (column: string, value: unknown) => {
          neqFilters.push({ column, value });
          return query;
        },
        lt: (column: string, value: string) => {
          expect(column).toBe("submitted_at");
          submittedBefore = value;
          return query;
        },
        order: () => query,
        limit: (count: number) =>
          Promise.resolve({
            data: applyFilters().slice(0, count),
            error: null,
          }),
        maybeSingle: () =>
          Promise.resolve({ data: applyFilters()[0] ?? null, error: null }),
      };
      return query;
    },
  };
  return client;
}

describe("getWritingProblem", () => {
  it("uses the first submittable candidate for the default writing route", async () => {
    const { client, calls } = makeClient([seed51, incomplete51, complete51]);

    const problem = await getWritingProblem(
      51,
      undefined,
      async () => client as never,
    );

    expect(problem?.id).toBe(COMPLETE_51_ID);
    expect(problem?.submitBlockedReason).toBeNull();
    expect(calls).toContainEqual({ type: "range", from: 0, to: 24 });
  });

  it("prefers the first untouched candidate for a user's default writing route", async () => {
    const untouched51 = complete51Problem(UNTOUCHED_51_ID, "Untouched 51");
    const { client } = makeClient({
      problems: [complete51, untouched51],
      writingSubmissions: [
        {
          user_id: "user-1",
          problem_id: COMPLETE_51_ID,
          feedback_status: "failed",
        },
      ],
    });

    const problem = await getWritingProblem(
      51,
      undefined,
      async () => client as never,
      { userId: "user-1" },
    );

    expect(problem?.id).toBe(UNTOUCHED_51_ID);
  });

  it("treats any draft row, including superseded, as touched for default selection", async () => {
    const untouched51 = complete51Problem(UNTOUCHED_51_ID, "Untouched 51");
    const { client } = makeClient({
      problems: [complete51, untouched51],
      writingDrafts: [
        {
          user_id: "user-1",
          problem_id: COMPLETE_51_ID,
          autosave_status: "superseded",
        },
      ],
    });

    const problem = await getWritingProblem(
      51,
      undefined,
      async () => client as never,
      { userId: "user-1" },
    );

    expect(problem?.id).toBe(UNTOUCHED_51_ID);
  });

  it("ignores other users' submissions and drafts for untouched selection", async () => {
    const untouched51 = complete51Problem(UNTOUCHED_51_ID, "Untouched 51");
    const { client } = makeClient({
      problems: [complete51, untouched51],
      writingSubmissions: [
        {
          user_id: "user-2",
          problem_id: COMPLETE_51_ID,
          feedback_status: "complete",
        },
      ],
      writingDrafts: [
        {
          user_id: "user-2",
          problem_id: COMPLETE_51_ID,
          autosave_status: "dirty",
        },
      ],
    });

    const problem = await getWritingProblem(
      51,
      undefined,
      async () => client as never,
      { userId: "user-1" },
    );

    expect(problem?.id).toBe(COMPLETE_51_ID);
  });

  it("continues scanning after the first candidate page when all visible candidates are touched", async () => {
    const touchedRows = Array.from({ length: 25 }, (_, index) =>
      complete51Problem(uuidFor51(index + 1), `Touched ${index + 1}`),
    );
    const untouched51 = complete51Problem(uuidFor51(26), "Untouched page 2");
    const { client, calls } = makeClient({
      problems: [...touchedRows, untouched51],
      writingSubmissions: touchedRows.map((row) => ({
        user_id: "user-1",
        problem_id: row.id,
        feedback_status: "complete",
      })),
    });

    const problem = await getWritingProblem(
      51,
      undefined,
      async () => client as never,
      { userId: "user-1" },
    );

    expect(problem?.id).toBe(untouched51.id);
    expect(calls).toContainEqual({ type: "range", from: 25, to: 49 });
  });

  it("skips untouched candidates that are not submittable", async () => {
    const untouched51 = complete51Problem(UNTOUCHED_51_ID, "Untouched 51");
    const { client } = makeClient({
      problems: [incomplete51, untouched51],
    });

    const problem = await getWritingProblem(
      51,
      undefined,
      async () => client as never,
      { userId: "user-1" },
    );

    expect(problem?.id).toBe(UNTOUCHED_51_ID);
    expect(problem?.submitBlockedReason).toBeNull();
  });

  it("falls back to the existing default when no untouched candidate remains", async () => {
    const untouched51 = complete51Problem(UNTOUCHED_51_ID, "Untouched 51");
    const { client } = makeClient({
      problems: [complete51, untouched51],
      writingSubmissions: [
        {
          user_id: "user-1",
          problem_id: COMPLETE_51_ID,
          feedback_status: "pending",
        },
      ],
      writingDrafts: [
        {
          user_id: "user-1",
          problem_id: UNTOUCHED_51_ID,
          autosave_status: "clean",
        },
      ],
    });

    const problem = await getWritingProblem(
      51,
      undefined,
      async () => client as never,
      { userId: "user-1" },
    );

    expect(problem?.id).toBe(COMPLETE_51_ID);
  });

  it("does not apply untouched filtering to an explicit problem id", async () => {
    const untouched51 = complete51Problem(UNTOUCHED_51_ID, "Untouched 51");
    const { client, calls } = makeClient({
      problems: [complete51, untouched51],
      writingSubmissions: [
        {
          user_id: "user-1",
          problem_id: COMPLETE_51_ID,
          feedback_status: "complete",
        },
      ],
    });

    const problem = await getWritingProblem(
      51,
      COMPLETE_51_ID,
      async () => client as never,
      { userId: "user-1" },
    );

    expect(problem?.id).toBe(COMPLETE_51_ID);
    expect(calls).not.toContainEqual({
      type: "from",
      table: "writing_submissions",
    });
    expect(calls).not.toContainEqual({ type: "from", table: "writing_drafts" });
  });

  it("keeps the existing default behavior when no user id is supplied", async () => {
    const untouched51 = complete51Problem(UNTOUCHED_51_ID, "Untouched 51");
    const { client, calls } = makeClient({
      problems: [complete51, untouched51],
      writingSubmissions: [
        {
          user_id: "user-1",
          problem_id: COMPLETE_51_ID,
          feedback_status: "complete",
        },
      ],
    });

    const problem = await getWritingProblem(
      51,
      undefined,
      async () => client as never,
    );

    expect(problem?.id).toBe(COMPLETE_51_ID);
    expect(calls).not.toContainEqual({
      type: "from",
      table: "writing_submissions",
    });
    expect(calls).not.toContainEqual({ type: "from", table: "writing_drafts" });
  });

  it("does not return a seed fixture even when explicitly requested", async () => {
    const { client, calls } = makeClient([seed51, complete51]);

    const problem = await getWritingProblem(
      51,
      SEED_51_ID,
      async () => client as never,
    );

    expect(problem).toBeNull();
    expect(calls).toContainEqual({
      type: "eq",
      column: "id",
      value: SEED_51_ID,
    });
  });

  it("returns null for an explicit problem id hidden by institution visibility", async () => {
    const { client } = makeClient([complete51]);
    const hiddenClient = {
      ...client,
      rpc: async () => ({ data: [], error: null }),
    };

    const problem = await getWritingProblem(
      51,
      COMPLETE_51_ID,
      async () => hiddenClient as never,
    );

    expect(problem).toBeNull();
  });

  it("keeps an explicit problem id even when the row is submit-blocked", async () => {
    const { client, calls } = makeClient([incomplete51, complete51]);

    const problem = await getWritingProblem(
      51,
      INCOMPLETE_51_ID,
      async () => client as never,
    );

    expect(problem?.id).toBe(INCOMPLETE_51_ID);
    expect(problem?.submitBlockedReason).toBe("problem_data_incomplete");
    expect(calls).toContainEqual({
      type: "eq",
      column: "id",
      value: INCOMPLETE_51_ID,
    });
    expect(calls).toContainEqual({ type: "limit", count: 1 });
  });

  it("returns null for a malformed (non-uuid) problem id without querying (D-3)", async () => {
    const { client, calls } = makeClient([incomplete51, complete51]);

    const problem = await getWritingProblem(
      51,
      "잘못된id",
      async () => client as never,
    );

    expect(problem).toBeNull();
    // uuid 형식 가드가 DB 조회 전에 끊어야 한다 — 쿼리 호출 0건.
    expect(calls).toEqual([]);
  });

  it("treats an empty problem id as the default selection, not malformed", async () => {
    const { client, calls } = makeClient([incomplete51, complete51]);

    const problem = await getWritingProblem(
      51,
      "",
      async () => client as never,
    );

    expect(problem?.id).toBe(COMPLETE_51_ID);
    expect(calls).toContainEqual({ type: "range", from: 0, to: 24 });
  });
});

describe("getWritingProblemAvailability", () => {
  it("allows retry for published public active problems", async () => {
    const { client } = makeAvailabilityClient({
      publish_status: "published",
      visibility: "public",
      lifecycle_status: "active",
      lifecycle_reason: null,
      question_no: 51,
    });
    const availability = await getWritingProblemAvailability(
      COMPLETE_51_ID,
      async () => client as never,
    );

    expect(availability.canStart).toBe(true);
    expect(availability.state).toBe("available");
  });

  it("blocks retry for published public inactive problems but keeps the reason", async () => {
    const { client } = makeAvailabilityClient({
      publish_status: "published",
      visibility: "public",
      lifecycle_status: "inactive",
      lifecycle_reason: "Rotation ended",
      question_no: 51,
    });
    const availability = await getWritingProblemAvailability(
      COMPLETE_51_ID,
      async () => client as never,
    );

    expect(availability.canStart).toBe(false);
    expect(availability.state).toBe("soft_unavailable");
    expect(availability.reason).toBe("Rotation ended");
  });

  it("blocks retry for institution users when the active problem is not assigned to the caller", async () => {
    const { client, rpcCalls } = makeAvailabilityClient(
      {
        publish_status: "published",
        visibility: "public",
        lifecycle_status: "active",
        lifecycle_reason: null,
        question_no: 51,
      },
      false,
    );

    const availability = await getWritingProblemAvailability(
      COMPLETE_51_ID,
      async () => client as never,
    );

    expect(availability.canStart).toBe(false);
    expect(availability.canSubmit).toBe(false);
    expect(availability.state).toBe("hard_unavailable");
    expect(rpcCalls).toEqual([
      {
        name: "is_writing_problem_visible_to_caller",
        args: { p_problem_id: COMPLETE_51_ID, p_question_no: 51 },
      },
    ]);
  });
});

describe("getNextWritingProblemStartHref", () => {
  const firstId = "10000000-0000-4000-8000-000000000052";
  const currentId = "20000000-0000-4000-8000-000000000052";
  const nextId = "30000000-0000-4000-8000-000000000052";
  const laterId = "40000000-0000-4000-8000-000000000052";

  function idForOrder(index: number): string {
    return `${index.toString(16).padStart(8, "0")}-0000-4000-8000-000000000052`;
  }

  function nextProblemRow(
    id: string,
    overrides: Partial<NextProblemRow> = {},
  ): NextProblemRow {
    return {
      id,
      domain: "writing",
      question_no: 52,
      publish_status: "published",
      lifecycle_status: "active",
      tags: [],
      materials: {},
      ...overrides,
    };
  }

  it("builds a fresh writing URL for the next visible problem id in the same question", async () => {
    const { client, calls } = makeNextProblemClient([
      nextProblemRow(currentId),
      nextProblemRow(nextId),
      nextProblemRow(firstId),
      nextProblemRow("00000000-0000-4000-8000-000000000053", {
        question_no: 53,
      }),
    ]);

    const href = await getNextWritingProblemStartHref({
      currentProblemId: currentId,
      questionNo: 52,
      createClient: async () => client as never,
    });

    expect(href).toBe(`/writing/answer-writing-52?problem=${nextId}&fresh=1`);
    expect(href).not.toContain("retrySubmission");
    expect(calls.filter((call) => call.type === "from")).toEqual([
      { type: "from", table: "problems" },
    ]);
  });

  it("wraps to the first eligible problem when the current id is last", async () => {
    const { client } = makeNextProblemClient([
      nextProblemRow(firstId),
      nextProblemRow(currentId),
      nextProblemRow(nextId),
    ]);

    const href = await getNextWritingProblemStartHref({
      currentProblemId: nextId,
      questionNo: 52,
      createClient: async () => client as never,
    });

    expect(href).toBe(`/writing/answer-writing-52?problem=${firstId}&fresh=1`);
  });

  it("uses keyset lookup so more than 200 earlier problems do not force an early wrap", async () => {
    const currentLargeSetId = idForOrder(200);
    const nextLargeSetId = idForOrder(201);
    const rows = [
      ...Array.from({ length: 200 }, (_, index) =>
        nextProblemRow(idForOrder(index)),
      ),
      nextProblemRow(currentLargeSetId),
      nextProblemRow(nextLargeSetId),
    ];
    const { client } = makeNextProblemClient(rows);

    const href = await getNextWritingProblemStartHref({
      currentProblemId: currentLargeSetId,
      questionNo: 52,
      createClient: async () => client as never,
    });

    expect(href).toBe(
      `/writing/answer-writing-52?problem=${nextLargeSetId}&fresh=1`,
    );
  });

  it("skips unavailable, hidden, and seed fixture problems", async () => {
    const hiddenId = "30000000-0000-4000-8000-000000000052";
    const inactiveId = "35000000-0000-4000-8000-000000000052";
    const draftId = "36000000-0000-4000-8000-000000000052";
    const seedId = "37000000-0000-4000-8000-000000000052";
    const { client } = makeNextProblemClient(
      [
        nextProblemRow(currentId),
        nextProblemRow(hiddenId),
        nextProblemRow(inactiveId, { lifecycle_status: "inactive" }),
        nextProblemRow(draftId, { publish_status: "draft" }),
        nextProblemRow(seedId, {
          tags: ["seed:wireframe_problem_fixtures"],
        }),
        nextProblemRow(laterId),
      ],
      [currentId, inactiveId, draftId, seedId, laterId],
    );

    const href = await getNextWritingProblemStartHref({
      currentProblemId: currentId,
      questionNo: 52,
      createClient: async () => client as never,
    });

    expect(href).toBe(`/writing/answer-writing-52?problem=${laterId}&fresh=1`);
  });

  it("opens the same problem as a fresh attempt when it is the only eligible candidate", async () => {
    const { client } = makeNextProblemClient([nextProblemRow(currentId)]);

    const href = await getNextWritingProblemStartHref({
      currentProblemId: currentId,
      questionNo: 52,
      createClient: async () => client as never,
    });

    expect(href).toBe(
      `/writing/answer-writing-52?problem=${currentId}&fresh=1`,
    );
  });

  it("falls back to the problem list when no eligible next problem exists", async () => {
    const { client } = makeNextProblemClient([]);

    const href = await getNextWritingProblemStartHref({
      currentProblemId: currentId,
      questionNo: 52,
      createClient: async () => client as never,
    });

    expect(href).toBe("/practice/problems");
  });
});

describe("getRetrySubmissionSeed", () => {
  it("returns the original submission answer only when it belongs to the same user, problem, and question", async () => {
    const seed = await getRetrySubmissionSeed({
      userId: "user-1",
      submissionId: "00000000-0000-0000-0000-000000000011",
      problemId: "00000000-0000-0000-0000-000000000001",
      questionNo: 54,
      createClient: async () =>
        makeRetrySeedClient([
          submissionRow({
            id: "00000000-0000-0000-0000-000000000011",
            user_id: "user-1",
            problem_id: "00000000-0000-0000-0000-000000000001",
            question_no: 54,
            answer_text: "previous answer",
            answer_json: { _v: "54.v1", text: "previous answer" },
          }),
        ]) as never,
    });

    expect(seed).toEqual({
      parent_submission_id: "00000000-0000-0000-0000-000000000011",
      answer_text: "previous answer",
      answer_json: { _v: "54.v1", text: "previous answer" },
    });
  });

  it("does not return another user's submission as a retry seed", async () => {
    const seed = await getRetrySubmissionSeed({
      userId: "user-1",
      submissionId: "00000000-0000-0000-0000-000000000011",
      problemId: "00000000-0000-0000-0000-000000000001",
      questionNo: 54,
      createClient: async () =>
        makeRetrySeedClient([
          submissionRow({
            id: "00000000-0000-0000-0000-000000000011",
            user_id: "user-2",
            problem_id: "00000000-0000-0000-0000-000000000001",
            question_no: 54,
            answer_text: "other answer",
          }),
        ]) as never,
    });

    expect(seed).toBeNull();
  });
});

describe("getComparisonTargetCandidates", () => {
  it("returns only previous submissions for the same problem and marks the selected parent", async () => {
    const current = submissionRow({
      id: "current",
      parent_submission_id: "parent",
      submitted_at: "2026-06-20T10:00:00.000Z",
    });
    const parent = submissionRow({
      id: "parent",
      char_count: 90,
      submitted_at: "2026-06-19T10:00:00.000Z",
    });
    const older = submissionRow({
      id: "older",
      char_count: 80,
      submitted_at: "2026-06-18T10:00:00.000Z",
    });
    const otherProblem = submissionRow({
      id: "other-problem",
      problem_id: "problem-53",
      submitted_at: "2026-06-19T12:00:00.000Z",
    });
    const laterSameProblem = submissionRow({
      id: "later",
      submitted_at: "2026-06-21T10:00:00.000Z",
    });

    const candidates = await getComparisonTargetCandidates(
      "current",
      "parent",
      async () =>
        makeComparisonClient(
          [current, parent, older, otherProblem, laterSameProblem],
          [feedbackRow("parent", 70), feedbackRow("older", 64)],
        ) as never,
    );

    expect(candidates.map((candidate) => candidate.submissionId)).toEqual([
      "parent",
      "older",
    ]);
    expect(candidates[0]).toMatchObject({
      submissionId: "parent",
      isSelected: true,
      isRecommended: true,
      isDisabled: false,
      score: 70,
    });
    expect(candidates[1]).toMatchObject({
      submissionId: "older",
      isSelected: false,
      isRecommended: false,
      isDisabled: false,
    });
  });

  it("disables same-problem submissions whose analysis is incomplete", async () => {
    const current = submissionRow({ id: "current" });
    const pending = submissionRow({
      id: "pending",
      feedback_status: "analyzing",
      submitted_at: "2026-06-19T10:00:00.000Z",
    });

    const candidates = await getComparisonTargetCandidates(
      "current",
      null,
      async () =>
        makeComparisonClient(
          [current, pending],
          [feedbackRow("pending", 70)],
        ) as never,
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      submissionId: "pending",
      isDisabled: true,
      isRecommended: false,
    });
  });
});
