"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "../supabase/server";
import type { Json } from "../supabase/types";
import {
  ExternalEvaluationApiError,
  getTalkpikApiBaseUrl,
  submitExternalWriting,
  toExternalTaskType,
} from "../writing-api/evaluation";
import {
  computeComparisonMetrics,
  generateNarrative,
} from "./comparison-service";
import type { QuestionNo } from "./types";

export type SubmitWritingInput = {
  draft_id?: string | null;
  problem_id: string;
  question_no: QuestionNo;
  answer_text: string;
  answer_json?: Record<string, unknown> | null;
  char_count: number;
};

export type SubmitWritingResult = {
  submissionId: string;
  questionNo: QuestionNo;
};

const WRITING_PROBLEM_NOT_SUBMITTABLE_MESSAGE =
  "현재 제출할 수 없는 문제입니다. 다른 문제를 선택해 주세요.";

function toSubmitWritingErrorMessage(message: string) {
  if (message.includes("problem_not_submittable")) {
    return WRITING_PROBLEM_NOT_SUBMITTABLE_MESSAGE;
  }
  return `submitWriting failed: ${message}`;
}

function isExternalSubmitNetworkError(error: unknown): error is TypeError {
  return error instanceof TypeError;
}

function isRecoverableExternalSubmitError(error: unknown): boolean {
  return (
    isExternalSubmitNetworkError(error) ||
    (error instanceof ExternalEvaluationApiError &&
      error.status >= 500 &&
      error.status < 600)
  );
}

async function createFailedLocalSubmission({
  serviceSupabase,
  userId,
  input,
}: {
  serviceSupabase: ReturnType<typeof createSupabaseServiceRoleClient>;
  userId: string;
  input: SubmitWritingInput;
}): Promise<SubmitWritingResult> {
  const submissionId = randomUUID();
  const { data, error } = await serviceSupabase.rpc(
    "create_external_writing_submission",
    {
      submission: {
        external_submission_id: submissionId,
        user_id: userId,
        problem_id: input.problem_id,
        draft_id: input.draft_id ?? null,
        question_no: input.question_no,
        answer_text: input.answer_text,
        answer_json: (input.answer_json ?? null) as Json | null,
        char_count: input.char_count,
        feedback_status: "failed",
      },
    } as never,
  );
  if (error) throw new Error(toSubmitWritingErrorMessage(error.message));
  if (data !== submissionId) {
    throw new Error("submitWriting: insert returned empty submission id");
  }
  return { submissionId, questionNo: input.question_no };
}

export async function submitWritingAction(
  input: SubmitWritingInput,
): Promise<SubmitWritingResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const externalBaseUrl = getTalkpikApiBaseUrl();
  if (externalBaseUrl) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    if (!accessToken) throw new Error("submitWriting: missing session token");
    const serviceSupabase = createSupabaseServiceRoleClient();
    const externalTaskType = toExternalTaskType(input.question_no);

    let external;
    try {
      external = await submitExternalWriting({
        baseUrl: externalBaseUrl,
        accessToken,
        payload: {
          task_type: externalTaskType,
          task_id: externalTaskType,
          text: input.answer_text,
          user_id: "current",
        },
      });
    } catch (error) {
      if (!isRecoverableExternalSubmitError(error)) throw error;
      console.warn(
        "[writing-submit] external_writing_submit_recoverable_failed",
        {
          questionNo: input.question_no,
          errorName: error instanceof Error ? error.name : "UnknownError",
          errorStatus:
            error instanceof ExternalEvaluationApiError ? error.status : null,
        },
      );
      return createFailedLocalSubmission({
        serviceSupabase,
        userId: user.id,
        input,
      });
    }

    const nextStatus = external.status === "failed" ? "failed" : "analyzing";
    const { data: localSubmissionId, error: createError } =
      await serviceSupabase.rpc("create_external_writing_submission", {
        submission: {
          external_submission_id: external.submission_id,
          user_id: user.id,
          problem_id: input.problem_id,
          draft_id: input.draft_id ?? null,
          question_no: input.question_no,
          answer_text: input.answer_text,
          answer_json: (input.answer_json ?? null) as Json | null,
          char_count: input.char_count,
          feedback_status: nextStatus,
        },
      } as never);
    if (createError) {
      throw new Error(toSubmitWritingErrorMessage(createError.message));
    }
    // RPC는 같은 draft에 활성 제출이 이미 있으면 그 기존 id를 멱등 반환한다(중복 제출 방지).
    // 반환 id는 이번 호출의 external.submission_id와 다를 수 있으므로, 반환 id를 신뢰한다.
    if (typeof localSubmissionId !== "string" || !localSubmissionId) {
      throw new Error(
        "submitWriting external local create returned empty submission id",
      );
    }

    return {
      submissionId: localSubmissionId,
      questionNo: input.question_no,
    };
  }

  const serviceSupabase = createSupabaseServiceRoleClient();
  return createFailedLocalSubmission({
    serviceSupabase,
    userId: user.id,
    input,
  });
}

export type CreateComparisonReportInput = {
  current_id: string;
  previous_id?: string | null;
};

export async function createComparisonReportAction(
  input: CreateComparisonReportInput,
): Promise<{ reportId: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: currentSub, error: curErr } = await supabase
    .from("writing_submissions")
    .select("*")
    .eq("id", input.current_id)
    .maybeSingle();
  if (curErr) throw new Error(`comparison: current ${curErr.message}`);
  if (!currentSub) throw new Error("comparison: current submission missing");

  const { data: prevSub } = input.previous_id
    ? await supabase
        .from("writing_submissions")
        .select("*")
        .eq("id", input.previous_id)
        .maybeSingle()
    : { data: null };

  const [{ data: curFeedback }, { data: curDims }] = await Promise.all([
    supabase
      .from("writing_feedback")
      .select("*")
      .eq("submission_id", currentSub.id)
      .maybeSingle(),
    supabase
      .from("feedback_dimension_scores")
      .select("*")
      .eq("submission_id", currentSub.id),
  ]);

  const prev =
    prevSub && input.previous_id
      ? await Promise.all([
          supabase
            .from("writing_feedback")
            .select("*")
            .eq("submission_id", input.previous_id)
            .maybeSingle(),
          supabase
            .from("feedback_dimension_scores")
            .select("*")
            .eq("submission_id", input.previous_id),
        ])
      : null;

  const metrics = computeComparisonMetrics({
    currentScore: curFeedback?.score_total ?? null,
    previousScore: prev?.[0].data?.score_total ?? null,
    currentDims: curDims ?? [],
    previousDims: prev?.[1].data ?? null,
    currentChars: currentSub.char_count,
    previousChars: prevSub?.char_count ?? null,
  });
  const narrative = generateNarrative(metrics);

  const { data: reportId, error: rpcErr } = await supabase.rpc(
    "create_comparison_report_with_metrics" as never,
    {
      current_id: input.current_id,
      previous_id: input.previous_id ?? null,
      metrics: metrics as unknown as Record<string, unknown>,
      narrative,
      ai_model: "comparison-local-v1",
    } as never,
  );
  if (rpcErr) throw new Error(`comparison rpc: ${rpcErr.message}`);
  return { reportId: (reportId as unknown as string) ?? "" };
}
