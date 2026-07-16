import { describe, expect, it, vi } from "vitest";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import {
  getCanonicalWritingProblems,
  getWritingSubmissionControl,
} from "@/lib/writing/canonical-source";
import { getWritingProblem } from "@/lib/writing/server";

function canonicalRow(overrides: Record<string, unknown> = {}) {
  return {
    problem_id: "11111111-1111-1111-1111-111111111111",
    question_id: "topik-writing-54-0001",
    canonical_import_id: 321,
    payload_hash: "payload-hash-321",
    item_number: 54,
    topik_level: 2,
    difficulty: 4,
    title: "환경 보호",
    prompt:
      "1) 환경 보호가 왜 필요합니까?\n2) 실천 방법은 무엇입니까?\n3) 사회는 무엇을 해야 합니까?",
    tags: ["환경"],
    materials: {
      prompt_questions: [
        "환경 보호가 왜 필요합니까?",
        "실천 방법은 무엇입니까?",
        "사회는 무엇을 해야 합니까?",
      ],
      required_structure: ["도입", "본론", "결론"],
      reasoning_pattern: "주장-근거-예시",
    },
    source_created_at: "2026-07-13T00:00:00.000Z",
    source_updated_at: "2026-07-13T00:00:00.000Z",
    ...overrides,
  };
}

function clientWithRows(
  rows: ReturnType<typeof canonicalRow>[],
  submissionMode: "blocked" | "verification" | "canonical" = "blocked",
) {
  return {
    rpc: vi.fn().mockImplementation((name: string) =>
      Promise.resolve(
        name === "get_writing_submission_control"
          ? {
              data: [
                {
                  submission_mode: submissionMode,
                  submission_contract_state: "unverified",
                },
              ],
              error: null,
            }
          : { data: rows, error: null },
      ),
    ),
  } as unknown as SupabaseServerClient;
}

describe("canonical writing source", () => {
  it("reads the fail-closed database submission control", async () => {
    const supabase = clientWithRows([]);

    await expect(getWritingSubmissionControl({ supabase })).resolves.toEqual({
      submissionMode: "blocked",
      submissionContractState: "unverified",
    });
    expect(supabase.rpc).toHaveBeenCalledWith(
      "get_writing_submission_control",
    );
  });

  it("parses the operations-only verification submission mode", async () => {
    const supabase = clientWithRows([], "verification");

    await expect(getWritingSubmissionControl({ supabase })).resolves.toEqual({
      submissionMode: "verification",
      submissionContractState: "unverified",
    });
  });

  it("maps versioned learner-safe RPC rows without an answer payload", async () => {
    const supabase = clientWithRows([canonicalRow()]);

    const [problem] = await getCanonicalWritingProblems({
      supabase,
      questionNo: 54,
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      "get_available_writing_questions",
      { p_item_number: 54, p_problem_id: null },
    );
    expect(problem).toMatchObject({
      id: "11111111-1111-1111-1111-111111111111",
      canonicalQuestionId: "topik-writing-54-0001",
      canonicalImportId: "321",
      payloadHash: "payload-hash-321",
      questionNo: 54,
      submitBlockedReason: null,
    });
    expect(problem).not.toHaveProperty("answerKey");
  });

  it("reads canonical content directly for an explicit problem route", async () => {
    const supabase = clientWithRows([canonicalRow()]);

    const problem = await getWritingProblem(
      54,
      "11111111-1111-1111-1111-111111111111",
      async () => supabase,
    );

    expect(problem?.canonicalImportId).toBe("321");
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });

});
