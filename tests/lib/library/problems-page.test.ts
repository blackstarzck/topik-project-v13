import { describe, expect, it } from "vitest";

import { listLibraryProblemDrafts } from "../../../src/lib/library/problems-page";

type QueryRow = Record<string, unknown>;

function makeClient({
  drafts,
  problems,
}: {
  drafts: QueryRow[];
  problems: QueryRow[];
}) {
  const calls: QueryRow[] = [];

  const client = {
    from: (table: string) => {
      const filters: Array<{ column: string; value: unknown }> = [];
      const neqFilters: Array<{ column: string; value: unknown }> = [];
      const inFilters: Array<{ column: string; values: unknown[] }> = [];
      const rows = table === "writing_drafts" ? drafts : problems;

      const resolveRows = () =>
        rows
          .filter((row) =>
            filters.every((filter) => row[filter.column] === filter.value),
          )
          .filter((row) =>
            neqFilters.every((filter) => row[filter.column] !== filter.value),
          )
          .filter((row) =>
            inFilters.every((filter) =>
              filter.values.includes(row[filter.column]),
            ),
          );

      const query = {
        select: (columns: string) => {
          calls.push({ type: "select", table, columns });
          return query;
        },
        eq: (column: string, value: unknown) => {
          calls.push({ type: "eq", table, column, value });
          filters.push({ column, value });
          return query;
        },
        neq: (column: string, value: unknown) => {
          calls.push({ type: "neq", table, column, value });
          neqFilters.push({ column, value });
          return query;
        },
        in: (column: string, values: unknown[]) => {
          calls.push({ type: "in", table, column, values });
          inFilters.push({ column, values });
          return query;
        },
        order: (column: string, options?: QueryRow) => {
          calls.push({ type: "order", table, column, options });
          return query;
        },
        then: (
          resolve: (value: { data: QueryRow[]; error: null }) => unknown,
          reject?: (reason: unknown) => unknown,
        ) => Promise.resolve({ data: resolveRows(), error: null }).then(resolve, reject),
      };

      return query;
    },
  };

  return { client, calls };
}

function draftRow(overrides: QueryRow = {}): QueryRow {
  return {
    id: "draft-1",
    user_id: "user-1",
    problem_id: "problem-51",
    question_no: 51,
    answer_text: "draft answer",
    answer_json: null,
    char_count: 12,
    autosave_status: "clean",
    last_saved_at: "2026-07-01T10:00:00.000Z",
    created_at: "2026-07-01T09:00:00.000Z",
    updated_at: "2026-07-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("listLibraryProblemDrafts", () => {
  it("maps meaningful active writing drafts as temporary-save library rows", async () => {
    const { client, calls } = makeClient({
      drafts: [
        draftRow(),
        draftRow({
          id: "draft-empty",
          problem_id: "problem-empty",
          answer_text: "  ",
          char_count: 2,
          last_saved_at: "2026-07-02T10:00:00.000Z",
        }),
        draftRow({
          id: "draft-superseded",
          problem_id: "problem-old",
          autosave_status: "superseded",
          answer_text: "submitted answer",
        }),
      ],
      problems: [
        {
          id: "problem-51",
          title: "No. 51 - Draft answer problem",
          question_no: 51,
        },
      ],
    });

    const result = await listLibraryProblemDrafts(
      "user-1",
      async () => client as never,
    );

    expect(result).toEqual([
      {
        kind: "draft",
        id: "draft-1",
        problem_id: "problem-51",
        problem_title: "No. 51 - Draft answer problem",
        question_no: 51,
        answer_text: "draft answer",
        char_count: 12,
        autosave_status: "clean",
        item_id: "draft:draft-1",
        saved_at: "2026-07-01T10:00:00.000Z",
        last_saved_at: "2026-07-01T10:00:00.000Z",
      },
    ]);
    expect(calls).toContainEqual({
      type: "neq",
      table: "writing_drafts",
      column: "autosave_status",
      value: "superseded",
    });
  });
});
