"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { ACCOUNT_INACTIVE_PATH } from "../auth/completion-routes";
import { fetchProfileStatus, isActiveStatus } from "../auth/profile";
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
import { toSubmitWritingErrorMessage as toSharedSubmitWritingErrorMessage } from "./submit-errors";
import type { QuestionNo } from "./types";

export type SubmitWritingInput = {
  draft_id?: string | null;
  problem_id: string;
  question_no: QuestionNo;
  answer_text: string;
  answer_json?: Record<string, unknown> | null;
  passage_context?: string | null;
  char_count: number;
};

export type SubmitWritingResult = {
  submissionId: string;
  questionNo: QuestionNo;
};

function toSubmitWritingErrorMessage(message: string) {
  return toSharedSubmitWritingErrorMessage(message);
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

// Q51/Q52 빈칸형 답안: answer_json.blanks({라벨ㄱ/ㄴ → 답})를 외부 API의 blanks로 전달한다.
// 빈칸 구조가 없으면(Q53/Q54, 또는 단일 텍스트로 저장된 Q52) null → 호출부에서 text 폴백.
function extractBlanksFromAnswerJson(
  answerJson: SubmitWritingInput["answer_json"],
): Record<string, string> | null {
  if (!answerJson || typeof answerJson !== "object") return null;
  const blanks = (answerJson as { blanks?: unknown }).blanks;
  if (!blanks || typeof blanks !== "object" || Array.isArray(blanks))
    return null;
  const out: Record<string, string> = {};
  for (const [label, value] of Object.entries(blanks)) {
    if (typeof value === "string" && value.trim().length > 0)
      out[label] = value;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export async function submitWritingAction(
  input: SubmitWritingInput,
): Promise<SubmitWritingResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  // 회원 탈퇴(deleted)/차단(blocked) 계정의 쓰기 제출·리포트 생성 차단.
  const accountStatus = await fetchProfileStatus(supabase, user.id);
  if (!isActiveStatus(accountStatus)) {
    redirect(`${ACCOUNT_INACTIVE_PATH}?status=${accountStatus ?? "deleted"}`);
  }

  const externalBaseUrl = getTalkpikApiBaseUrl();
  if (externalBaseUrl) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    if (!accessToken) throw new Error("submitWriting: missing session token");
    const serviceSupabase = createSupabaseServiceRoleClient();
    const externalTaskType = toExternalTaskType(input.question_no);

    // 외부 채점 API는 question_id(= §7 question_id, GET /api/writing/tasks가 주는 값)로 해당 문항의
    // prompt/모범답안/루브릭에 맞춰 채점한다. §7 미러 problems.materials(raw_payload)에 원본
    // question_id가 들어 있으므로 그대로 꺼내 전달한다(없으면 null → task_type 임의 문항 ad-hoc 채점).
    const { data: problemRow } = await serviceSupabase
      .from("problems")
      .select("materials")
      .eq("id", input.problem_id)
      .maybeSingle();
    const materials = problemRow?.materials;
    const externalQuestionId =
      materials && typeof materials === "object" && !Array.isArray(materials)
        ? (((materials as Record<string, unknown>).question_id as
            | string
            | null
            | undefined) ?? null)
        : null;

    // Q51/Q52는 blanks(ㄱ/ㄴ→답)로, Q53/Q54(및 blanks 미보유)는 text로 제출한다.
    // user_id는 보내지 않는다 — 백엔드가 JWT에서 취득(외부 계약).
    const blanks = extractBlanksFromAnswerJson(input.answer_json);
    const passageContext = input.passage_context?.trim() || undefined;
    const externalPayload = blanks
      ? {
          task_type: externalTaskType,
          question_id: externalQuestionId,
          blanks,
          ...(passageContext ? { passage_context: passageContext } : {}),
          lang: "ko",
        }
      : {
          task_type: externalTaskType,
          question_id: externalQuestionId,
          text: input.answer_text,
          lang: "ko",
        };

    let external;
    try {
      external = await submitExternalWriting({
        baseUrl: externalBaseUrl,
        accessToken,
        payload: externalPayload,
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
  // 회원 탈퇴(deleted)/차단(blocked) 계정의 쓰기 제출·리포트 생성 차단.
  const accountStatus = await fetchProfileStatus(supabase, user.id);
  if (!isActiveStatus(accountStatus)) {
    redirect(`${ACCOUNT_INACTIVE_PATH}?status=${accountStatus ?? "deleted"}`);
  }

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
