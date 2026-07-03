import { describe, expect, it } from "vitest";
import { upsertDraft } from "../../../src/lib/writing/mutations";
import type {
  WritingDraftInsert,
  WritingDraftRow,
} from "../../../src/lib/writing/types";

type FakeError = { code?: string; message: string } | null;
type Call =
  | { type: "lookup"; table: string; userId: string; problemId: string }
  | { type: "insert"; table: string; payload: WritingDraftInsert }
  | {
      type: "update";
      table: string;
      draftId: string;
      payload: WritingDraftInsert;
    };

const INPUT: WritingDraftInsert = {
  user_id: "user-1",
  problem_id: "problem-1",
  question_no: 53,
  answer_text: "자동 저장할 답안",
  answer_json: null,
  char_count: 9,
  autosave_status: "clean",
  last_saved_at: "2026-06-08T00:00:00.000Z",
};

function makeRow(input: WritingDraftInsert, id = "draft-1"): WritingDraftRow {
  return {
    id,
    user_id: input.user_id,
    problem_id: input.problem_id,
    question_no: input.question_no,
    answer_text: input.answer_text ?? null,
    answer_json: input.answer_json ?? null,
    char_count: input.char_count ?? null,
    autosave_status: input.autosave_status ?? "clean",
    last_saved_at: input.last_saved_at ?? null,
    created_at: "2026-06-08T00:00:00.000Z",
    updated_at: "2026-06-08T00:00:00.000Z",
  };
}

function makeClient(opts: {
  lookupIds?: Array<string | null>;
  insertError?: FakeError;
  insertData?: WritingDraftRow | null;
  updateData?: WritingDraftRow | null;
  updateError?: FakeError;
}) {
  const calls: Call[] = [];
  const lookupIds = [...(opts.lookupIds ?? [null])];

  const client = {
    calls,
    from: (table: string) => ({
      select: () => ({
        eq: (_userCol: string, userId: string) => ({
          eq: (_problemCol: string, problemId: string) => ({
            neq: () => ({
              maybeSingle: () => {
                calls.push({ type: "lookup", table, userId, problemId });
                const id = lookupIds.shift() ?? null;
                return Promise.resolve({
                  data: id ? { id } : null,
                  error: null,
                });
              },
            }),
          }),
        }),
      }),
      update: (payload: WritingDraftInsert) => ({
        eq: (_idCol: string, draftId: string) => ({
          neq: () => ({
            select: () => ({
              maybeSingle: () => {
                calls.push({ type: "update", table, draftId, payload });
                return Promise.resolve({
                  data: opts.updateData ?? makeRow(payload, draftId),
                  error: opts.updateError ?? null,
                });
              },
            }),
          }),
        }),
      }),
      insert: (payload: WritingDraftInsert) => ({
        select: () => ({
          single: () => {
            calls.push({ type: "insert", table, payload });
            return Promise.resolve({
              data: opts.insertData ?? makeRow(payload, "inserted-draft"),
              error: opts.insertError ?? null,
            });
          },
        }),
      }),
      upsert: () => {
        throw new Error("unexpected PostgREST upsert");
      },
    }),
  };

  return client;
}

describe("upsertDraft", () => {
  it("updates the active draft instead of targeting a partial unique index with upsert", async () => {
    const client = makeClient({ lookupIds: ["draft-active"] });

    const result = await upsertDraft(INPUT, () => client as never);

    expect(result.id).toBe("draft-active");
    expect(client.calls.map((call) => call.type)).toEqual(["lookup", "update"]);
    expect(client.calls[1]).toMatchObject({
      type: "update",
      draftId: "draft-active",
      payload: INPUT,
    });
  });

  it("inserts a new draft when no active draft exists", async () => {
    const client = makeClient({ lookupIds: [null] });

    const result = await upsertDraft(INPUT, () => client as never);

    expect(result.id).toBe("inserted-draft");
    expect(client.calls.map((call) => call.type)).toEqual(["lookup", "insert"]);
  });

  it("recovers when another autosave creates the active draft between lookup and insert", async () => {
    const client = makeClient({
      lookupIds: [null, "raced-draft"],
      insertError: { code: "23505", message: "duplicate key value" },
      insertData: null,
    });

    const result = await upsertDraft(INPUT, () => client as never);

    expect(result.id).toBe("raced-draft");
    expect(client.calls.map((call) => call.type)).toEqual([
      "lookup",
      "insert",
      "lookup",
      "update",
    ]);
  });
});
