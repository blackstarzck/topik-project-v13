import { createHash, randomUUID } from "node:crypto";
import type { SupabaseServerClient } from "../supabase/server";
import {
  normalizeWritingProblem,
  type NormalizedWritingProblem,
} from "./problem-normalizer";
import { isQuestionNo, type QuestionNo } from "./types";

export type WritingSubmissionMode = "blocked" | "verification" | "canonical";
export type WritingSubmissionContractState =
  | "unverified"
  | "provider_verified"
  | "local_outbox_verified";

export type WritingSubmissionControl = {
  submissionMode: WritingSubmissionMode;
  submissionContractState: WritingSubmissionContractState;
};

let writingSubmissionControlForTests: WritingSubmissionControl | null = null;

export function setWritingSubmissionControlForTests(
  state: WritingSubmissionControl | null,
): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("writing_submission_control_test_override_forbidden");
  }
  writingSubmissionControlForTests = state;
}

export type CanonicalWritingQuestionRow = {
  problem_id: string;
  question_id: string;
  canonical_import_id: number | string;
  payload_hash: string;
  item_number: number;
  topik_level: number;
  difficulty: number | null;
  title: string;
  prompt: string;
  tags: string[] | null;
  materials: unknown;
  source_created_at: string;
  source_updated_at: string;
};

type CanonicalWritingQuestionResult = {
  data: CanonicalWritingQuestionRow[] | null;
  error: { message: string } | null;
};

type CanonicalRpcClient = {
  rpc: (
    name: "get_available_writing_questions",
    args: { p_item_number: QuestionNo | null; p_problem_id: string | null },
  ) => Promise<CanonicalWritingQuestionResult>;
};

type WritingSubmissionControlRow = {
  submission_mode: WritingSubmissionMode;
  submission_contract_state: WritingSubmissionContractState;
};

type SubmissionControlRpcClient = {
  rpc: (name: "get_writing_submission_control") => Promise<{
    data:
      | WritingSubmissionControlRow[]
      | WritingSubmissionControlRow
      | null;
    error: { message: string } | null;
  }>;
};

export type CanonicalWritingSubmissionContext = {
  questionId: string;
  canonicalImportId: string;
  payloadHash: string;
  snapshot: {
    question_id: string;
    canonical_import_id: string;
    payload_hash: string;
    item_number: QuestionNo;
    topik_level: number;
    difficulty: number | null;
    title: string;
    prompt: string;
    tags: string[];
    materials: unknown;
  };
};

export async function getWritingSubmissionControl({
  supabase,
}: {
  supabase: SupabaseServerClient;
}): Promise<WritingSubmissionControl> {
  if (writingSubmissionControlForTests) return writingSubmissionControlForTests;

  const rpcClient = supabase as unknown as SubmissionControlRpcClient;
  const result = await rpcClient.rpc("get_writing_submission_control");
  if (result.error) {
    throw new Error(`getWritingSubmissionControl: ${result.error.message}`);
  }

  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  if (!isWritingSubmissionControlRow(row)) {
    throw new Error("getWritingSubmissionControl: invalid control state");
  }

  return {
    submissionMode: row.submission_mode,
    submissionContractState: row.submission_contract_state,
  };
}

function isWritingSubmissionControlRow(
  value: WritingSubmissionControlRow | null | undefined,
): value is WritingSubmissionControlRow {
  return (
    value !== null &&
    value !== undefined &&
    ["blocked", "verification", "canonical"].includes(
      value.submission_mode,
    ) &&
    ["unverified", "provider_verified", "local_outbox_verified"].includes(
      value.submission_contract_state,
    )
  );
}

export async function getCanonicalWritingProblems({
  supabase,
  questionNo = null,
  problemId = null,
}: {
  supabase: SupabaseServerClient;
  questionNo?: QuestionNo | null;
  problemId?: string | null;
}): Promise<NormalizedWritingProblem[]> {
  const rows = await getCanonicalWritingRows({
    supabase,
    questionNo,
    problemId,
  });

  return rows.flatMap((row) => {
    if (!isQuestionNo(row.item_number)) return [];
    return [
      normalizeWritingProblem({
        id: row.problem_id,
        canonicalQuestionId: row.question_id,
        canonicalImportId: String(row.canonical_import_id),
        payloadHash: row.payload_hash,
        topikLevel: row.topik_level,
        difficulty: row.difficulty,
        tags: row.tags,
        title: row.title,
        prompt: row.prompt,
        questionNo: row.item_number,
        materials: row.materials,
        lifecycleStatus: "active",
        lifecycleReason: null,
      }),
    ];
  });
}

async function getCanonicalWritingRows({
  supabase,
  questionNo = null,
  problemId = null,
}: {
  supabase: SupabaseServerClient;
  questionNo?: QuestionNo | null;
  problemId?: string | null;
}): Promise<CanonicalWritingQuestionRow[]> {
  const rpcClient = supabase as unknown as CanonicalRpcClient;
  const startedAt = Date.now();
  const result = await rpcClient.rpc("get_available_writing_questions", {
    p_item_number: questionNo,
    p_problem_id: problemId,
  });

  if (result.error) {
    throw new Error(`getCanonicalWritingProblems: ${result.error.message}`);
  }

  const rows = result.data ?? [];
  console.info("writing_source_read", {
    correlationId: randomUUID(),
    source: "canonical",
    status: "success",
    rowCount: rows.length,
    latencyMs: Date.now() - startedAt,
    questionNo: questionNo ?? null,
    problemIdHash: problemId
      ? createHash("sha256").update(problemId).digest("hex")
      : null,
  });
  return rows;
}

export async function getCanonicalWritingSubmissionContext({
  supabase,
  questionNo,
  problemId,
}: {
  supabase: SupabaseServerClient;
  questionNo: QuestionNo;
  problemId: string;
}): Promise<CanonicalWritingSubmissionContext> {
  const rows = await getCanonicalWritingRows({
    supabase,
    questionNo,
    problemId,
  });
  const row = rows[0];
  if (!row || !isQuestionNo(row.item_number)) {
    throw new Error("canonical_problem_not_submittable");
  }

  const canonicalImportId = String(row.canonical_import_id);
  return {
    questionId: row.question_id,
    canonicalImportId,
    payloadHash: row.payload_hash,
    snapshot: {
      question_id: row.question_id,
      canonical_import_id: canonicalImportId,
      payload_hash: row.payload_hash,
      item_number: row.item_number,
      topik_level: row.topik_level,
      difficulty: row.difficulty,
      title: row.title,
      prompt: row.prompt,
      tags: row.tags ?? [],
      materials: row.materials,
    },
  };
}
