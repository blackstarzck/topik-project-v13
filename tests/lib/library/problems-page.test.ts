import { describe, expect, it, vi } from "vitest";
import { listLibraryProblemDrafts } from "../../../src/lib/library/problems-page";

type Row = Record<string, unknown>;

function canonicalRow(problemId: string, itemNumber: number, title: string) {
  return {
    problem_id: problemId,
    question_id: `topik-writing-${itemNumber}-0001`,
    canonical_import_id: 101,
    payload_hash: `hash-${problemId}`,
    item_number: itemNumber,
    topik_level: 2,
    difficulty: 3,
    title,
    prompt: "Writing prompt",
    tags: [],
    materials: {},
    source_created_at: "2026-07-13T00:00:00.000Z",
    source_updated_at: "2026-07-13T00:00:00.000Z",
  };
}

function draft(overrides: Row = {}): Row {
  return {
    id: "draft-1",
    user_id: "user-1",
    problem_id: "problem-51",
    question_no: 51,
    answer_text: "saved answer",
    answer_json: null,
    char_count: 12,
    autosave_status: "clean",
    last_saved_at: "2026-07-01T10:00:00.000Z",
    created_at: "2026-07-01T09:00:00.000Z",
    updated_at: "2026-07-01T10:00:00.000Z",
    ...overrides,
  };
}

function makeClient(rows: Row[], canonicalRows: Row[], canonicalError?: string) {
  const from = vi.fn((table: string) => {
    if (table !== "writing_drafts") throw new Error(`unexpected table ${table}`);
    let current = rows;
    const query = {
      select: () => query,
      eq: (column: string, value: unknown) => {
        current = current.filter((row) => row[column] === value);
        return query;
      },
      neq: (column: string, value: unknown) => {
        current = current.filter((row) => row[column] !== value);
        return query;
      },
      order: () => query,
      then: (resolve: (value: { data: Row[]; error: null }) => unknown) =>
        Promise.resolve({ data: current, error: null }).then(resolve),
    };
    return query;
  });
  const rpc = vi.fn().mockResolvedValue({
    data: canonicalRows,
    error: canonicalError ? { message: canonicalError } : null,
  });
  return { from, rpc };
}

describe("listLibraryProblemDrafts", () => {
  it("keeps the saved answer and hydrates only current metadata from canonical", async () => {
    const client = makeClient(
      [draft(), draft({ id: "empty", answer_text: "  ", char_count: 2 })],
      [canonicalRow("problem-51", 51, "Canonical question 51")],
    );

    const result = await listLibraryProblemDrafts("user-1", async () => client as never);

    expect(result).toEqual([
      expect.objectContaining({
        id: "draft-1",
        problem_id: "problem-51",
        problem_title: "Canonical question 51",
        question_no: 51,
        answer_text: "saved answer",
        item_id: "draft:draft-1",
      }),
    ]);
    expect(client.rpc).toHaveBeenCalledWith("get_available_writing_questions", {
      p_item_number: null,
      p_problem_id: null,
    });
  });

  it("preserves an existing draft when its question is no longer in the current catalog", async () => {
    const client = makeClient([draft()], []);

    const result = await listLibraryProblemDrafts("user-1", async () => client as never);

    expect(result[0]).toEqual(expect.objectContaining({
      problem_title: null,
      question_no: 51,
      answer_text: "saved answer",
    }));
  });

  it("surfaces canonical catalog failures and never queries public.problems", async () => {
    const client = makeClient([draft()], [], "catalog unavailable");

    await expect(
      listLibraryProblemDrafts("user-1", async () => client as never),
    ).rejects.toThrow("getCanonicalWritingProblems: catalog unavailable");
    expect(client.from).not.toHaveBeenCalledWith("problems");
  });
});
