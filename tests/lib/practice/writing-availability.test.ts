import { describe, expect, it, vi } from "vitest";
import { getWritingAvailability } from "../../../src/lib/practice/writing-availability";

function canonicalRow(problemId: string, itemNumber: number) {
  return {
    problem_id: problemId,
    question_id: `topik-writing-${itemNumber}-0001`,
    canonical_import_id: 1,
    payload_hash: `hash-${itemNumber}`,
    item_number: itemNumber,
    topik_level: 2,
    difficulty: 3,
    title: `${itemNumber}번 문제`,
    prompt: "문제 본문",
    tags: [],
    materials: {},
    source_created_at: "2026-07-13T00:00:00.000Z",
    source_updated_at: "2026-07-13T00:00:00.000Z",
  };
}

function makeClient(rows: ReturnType<typeof canonicalRow>[], error?: string) {
  const rpc = vi.fn().mockResolvedValue({
    data: rows,
    error: error ? { message: error } : null,
  });
  return { rpc };
}

describe("getWritingAvailability", () => {
  it("derives available question types exclusively from the canonical catalog", async () => {
    const client = makeClient([
      canonicalRow("canonical-51", 51),
      canonicalRow("canonical-54", 54),
      canonicalRow("ignored-50", 50),
    ]);

    await expect(
      getWritingAvailability(async () => client as never),
    ).resolves.toEqual({
      availableTypes: [51, 54],
      lockedTypes: [52, 53],
      hasAny: true,
    });
    expect(client.rpc).toHaveBeenCalledWith("get_available_writing_questions", {
      p_item_number: null,
      p_problem_id: null,
    });
  });

  it("locks every writing type when the canonical catalog is empty", async () => {
    const client = makeClient([]);

    await expect(
      getWritingAvailability(async () => client as never),
    ).resolves.toEqual({
      availableTypes: [],
      lockedTypes: [51, 52, 53, 54],
      hasAny: false,
    });
  });

  it("surfaces a canonical catalog failure instead of reading mirror content", async () => {
    const client = makeClient([], "catalog unavailable");

    await expect(
      getWritingAvailability(async () => client as never),
    ).rejects.toThrow("getCanonicalWritingProblems: catalog unavailable");
  });
});
