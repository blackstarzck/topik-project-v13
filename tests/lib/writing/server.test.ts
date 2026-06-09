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

const incomplete51: QueryRow = {
  id: "incomplete-51",
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
  id: "complete-51",
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

    expect(problem?.id).toBe("complete-51");
    expect(problem?.submitBlockedReason).toBeNull();
    expect(calls).toContainEqual({ type: "limit", count: 25 });
  });

  it("keeps an explicit problem id even when the row is submit-blocked", async () => {
    const { client, calls } = makeClient([incomplete51, complete51]);

    const problem = await getWritingProblem(
      51,
      "incomplete-51",
      async () => client as never,
    );

    expect(problem?.id).toBe("incomplete-51");
    expect(problem?.submitBlockedReason).toBe("problem_data_incomplete");
    expect(calls).toContainEqual({
      type: "eq",
      column: "id",
      value: "incomplete-51",
    });
    expect(calls).toContainEqual({ type: "limit", count: 1 });
  });
});
