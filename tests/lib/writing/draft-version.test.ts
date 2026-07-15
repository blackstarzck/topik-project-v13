import { describe, expect, it } from "vitest";
import { isWritingDraftVersionStale } from "../../../src/lib/writing/draft-version";
import type { WritingDraftRow } from "../../../src/lib/writing/types";

const current = {
  questionId: "topik-writing-54-0001",
  importId: "321",
  payloadHash: "hash-321",
};

function draft(overrides: Partial<WritingDraftRow> = {}): WritingDraftRow {
  return {
    id: "draft-1",
    user_id: "user-1",
    problem_id: "problem-1",
    question_no: 54,
    answer_text: "preserved answer",
    answer_json: null,
    char_count: 16,
    canonical_question_id: current.questionId,
    canonical_import_id: Number(current.importId),
    canonical_payload_hash: current.payloadHash,
    question_snapshot: {
      question_id: current.questionId,
      canonical_import_id: current.importId,
      payload_hash: current.payloadHash,
      item_number: 54,
    },
    legacy_cutover_snapshot: null,
    autosave_status: "clean",
    last_saved_at: "2026-07-13T00:00:00.000Z",
    created_at: "2026-07-13T00:00:00.000Z",
    updated_at: "2026-07-13T00:00:00.000Z",
    ...overrides,
  };
}

describe("writing draft canonical version", () => {
  it("accepts an exact pinned draft snapshot", () => {
    expect(isWritingDraftVersionStale(draft(), current)).toBe(false);
  });

  it.each([51, 52, 53, 54])(
    "marks a Q%s draft stale when the payload changes under the same problem ID",
    (questionNo) => {
      expect(
        isWritingDraftVersionStale(draft({ question_no: questionNo }), {
          ...current,
          payloadHash: "hash-322",
        }),
      ).toBe(true);
    },
  );

  it("treats an unversioned legacy draft as stale on a canonical page", () => {
    expect(
      isWritingDraftVersionStale(
        draft({
          canonical_question_id: null,
          canonical_import_id: null,
          canonical_payload_hash: null,
          question_snapshot: null,
        }),
        current,
      ),
    ).toBe(true);
  });

  it("does not interfere with a legacy page that has no canonical version", () => {
    expect(
      isWritingDraftVersionStale(draft(), {
        questionId: null,
        importId: null,
        payloadHash: null,
      }),
    ).toBe(false);
  });
});
