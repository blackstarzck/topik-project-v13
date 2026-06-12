import { describe, expect, it } from "vitest";

import { getWritingProblem } from "../../../src/lib/writing/server";

type QueryRow = {
  id: string;
  title: string;
  prompt: string;
  question_no: number | null;
  materials: unknown;
  answer_key: unknown;
  rubric: unknown;
  lifecycle_status?: "active" | "inactive" | "expired" | null;
  lifecycle_reason?: string | null;
};

type Call =
  | { type: "eq"; column: string; value: unknown }
  | { type: "limit"; count: number }
  | { type: "order"; column: string };

// 실제 problems.id는 uuid — getWritingProblem의 D-3 uuid 형식 가드를 통과해야
// 하므로 fixture id도 uuid 형식을 쓴다 (이전 "incomplete-51" 류 문자열은 가드에
// 걸려 explicit-id 케이스가 무의미해진다).
const INCOMPLETE_51_ID = "11111111-1111-4111-8111-111111111151";
const COMPLETE_51_ID = "22222222-2222-4222-8222-222222222251";

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

function makeClient(rows: QueryRow[]) {
  const calls: Call[] = [];
  const client = {
    from: () => {
      const filters: Array<{ column: string; value: unknown }> = [];
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => {
          calls.push({ type: "eq", column, value });
          filters.push({ column, value });
          return query;
        },
        order: (column: string) => {
          calls.push({ type: "order", column });
          return query;
        },
        limit: (count: number) => {
          calls.push({ type: "limit", count });
          return query;
        },
        then: (
          resolve: (value: { data: QueryRow[]; error: null }) => unknown,
          reject?: (reason: unknown) => unknown,
        ) => {
          const idFilter = filters.find((filter) => filter.column === "id");
          const data = idFilter
            ? rows.filter((row) => row.id === idFilter.value)
            : rows;
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  return { client, calls };
}

describe("getWritingProblem", () => {
  it("uses the first submittable candidate for the default writing route", async () => {
    const { client, calls } = makeClient([incomplete51, complete51]);

    const problem = await getWritingProblem(
      51,
      undefined,
      async () => client as never,
    );

    expect(problem?.id).toBe(COMPLETE_51_ID);
    expect(problem?.submitBlockedReason).toBeNull();
    expect(calls).toContainEqual({ type: "limit", count: 25 });
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

    const problem = await getWritingProblem(51, "", async () => client as never);

    expect(problem?.id).toBe(COMPLETE_51_ID);
    expect(calls).toContainEqual({ type: "limit", count: 25 });
  });
});
