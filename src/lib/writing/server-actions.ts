"use server";

import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { redirect } from "next/navigation";
import { asLocale, DEFAULT_LOCALE, type Locale } from "@/i18n/locales";
import { ACCOUNT_INACTIVE_PATH } from "../auth/completion-routes";
import { fetchProfileStatus, isActiveStatus } from "../auth/profile";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role.server";
import { createSupabaseServerClient } from "../supabase/server";
import type { Json, Tables } from "../supabase/types";
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
import {
  getComparisonReportViewModel,
  type ComparisonReportViewModel,
} from "./comparison-report-view-model";
import {
  buildComparisonScoreItems,
  toComparisonMetricScoreItems,
} from "./comparison-score-items";
import {
  getCanonicalWritingSubmissionContext,
  getWritingSubmissionControl,
  type CanonicalWritingSubmissionContext,
} from "./canonical-source";
import {
  buildWritingSubmissionIntentPayload,
  dispatchWritingSubmissionIntent,
} from "./submission-outbox";
import { toSubmitWritingErrorMessage as toSharedSubmitWritingErrorMessage } from "./submit-errors";
import type { FeedbackBundle, QuestionNo, WritingSubmissionRow } from "./types";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export type SubmitWritingInput = {
  submission_intent_id?: string;
  draft_id?: string | null;
  parent_submission_id?: string | null;
  problem_id: string;
  question_no: QuestionNo;
  answer_text: string;
  answer_json?: Record<string, unknown> | null;
  passage_context?: string | null;
  char_count: number;
  canonical_question_id?: string | null;
  canonical_import_id?: string | null;
  canonical_payload_hash?: string | null;
};

export type SubmitWritingResult = {
  submissionId: string;
  questionNo: QuestionNo;
};

export type SubmitWritingRejectedResult = {
  submissionId?: never;
  questionNo?: never;
  rejection: {
    code: "writing_submission_temporarily_blocked";
    message: string;
  };
};

export type SubmitWritingActionResult =
  | SubmitWritingResult
  | SubmitWritingRejectedResult;

export type ReplaceStaleWritingDraftInput = {
  draftId: string;
  questionId: string;
  importId: string;
  payloadHash: string;
};

function hashWritingIdentifier(
  value: string | null | undefined,
): string | null {
  return value ? createHash("sha256").update(value).digest("hex") : null;
}

function reportWritingVersionConflict({
  code,
  problemId,
  draftId,
  questionId,
}: {
  code: string;
  problemId?: string | null;
  draftId?: string | null;
  questionId?: string | null;
}) {
  const problemIdHash = hashWritingIdentifier(problemId);
  const draftIdHash = hashWritingIdentifier(draftId);
  const questionIdHash = hashWritingIdentifier(questionId);
  console.warn("writing_version_conflict", {
    correlationId: createHash("sha256")
      .update(
        [code, problemIdHash, draftIdHash, questionIdHash]
          .map((value) => value ?? "missing")
          .join(":"),
      )
      .digest("hex")
      .slice(0, 24),
    code,
    problemIdHash,
    draftIdHash,
    questionIdHash,
  });
}

export async function replaceStaleWritingDraftAction(
  input: ReplaceStaleWritingDraftInput,
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");

  const importId = Number(input.importId);
  if (
    !input.draftId.trim() ||
    !input.questionId.trim() ||
    !Number.isSafeInteger(importId) ||
    importId <= 0 ||
    !input.payloadHash.trim()
  ) {
    throw new Error("stale_draft_current_version_invalid");
  }

  const { data, error } = await supabase.rpc("replace_stale_writing_draft", {
    p_draft_id: input.draftId,
    p_current_question_id: input.questionId,
    p_current_import_id: importId,
    p_current_payload_hash: input.payloadHash,
  });
  if (error) {
    reportWritingVersionConflict({
      code: "stale_draft_replace_conflict",
      draftId: input.draftId,
      questionId: input.questionId,
    });
    throw new Error(`replace_stale_writing_draft: ${error.message}`);
  }
  if (!data) throw new Error("replace_stale_writing_draft: empty result");

  return { draftId: data };
}

function toSubmitWritingErrorMessage(message: string) {
  return toSharedSubmitWritingErrorMessage(message);
}

function isAmbiguousExternalSubmitError(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (error instanceof Error && error.name === "AbortError") ||
    (error instanceof ExternalEvaluationApiError &&
      error.status >= 500 &&
      error.status < 600)
  );
}

function externalSubmitFailureCode(error: unknown): string {
  if (error instanceof ExternalEvaluationApiError) {
    return `provider_http_${error.status}`;
  }
  if (error instanceof Error && error.name === "AbortError") {
    return "provider_timeout";
  }
  return "provider_network_error";
}

function requireSubmissionIntentId(input: SubmitWritingInput): string {
  const intentId = input.submission_intent_id?.trim() ?? "";
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      intentId,
    )
  ) {
    throw new Error("writing_submission_intent_id_required");
  }
  return intentId;
}

function assertCanonicalRenderVersion({
  input,
  context,
}: {
  input: SubmitWritingInput;
  context: CanonicalWritingSubmissionContext;
}) {
  const renderedQuestionId = input.canonical_question_id?.trim();
  const renderedImportId = input.canonical_import_id?.trim();
  const renderedPayloadHash = input.canonical_payload_hash?.trim();

  if (!renderedQuestionId || !renderedImportId || !renderedPayloadHash) {
    throw new Error("canonical_render_version_required");
  }

  if (
    renderedQuestionId !== context.questionId ||
    renderedImportId !== context.canonicalImportId ||
    renderedPayloadHash !== context.payloadHash
  ) {
    reportWritingVersionConflict({
      code: "canonical_question_version_conflict",
      problemId: input.problem_id,
      draftId: input.draft_id,
      questionId: context.questionId,
    });
    throw new Error("canonical_question_version_conflict");
  }
}

async function assertCanonicalDraftVersion({
  supabase,
  userId,
  input,
  context,
}: {
  supabase: SupabaseServerClient;
  userId: string;
  input: SubmitWritingInput;
  context: CanonicalWritingSubmissionContext;
}): Promise<string> {
  if (!input.draft_id) {
    throw new Error("writing_submission_draft_required");
  }

  const { data, error } = await supabase
    .from("writing_drafts")
    .select(
      "canonical_question_id, canonical_import_id, canonical_payload_hash, question_snapshot",
    )
    .eq("id", input.draft_id)
    .eq("user_id", userId)
    .eq("problem_id", input.problem_id)
    .maybeSingle();
  if (error) {
    throw new Error(`canonical_draft_version_lookup_failed: ${error.message}`);
  }
  if (!data) throw new Error("draft_not_owned");

  if (
    data.canonical_question_id !== context.questionId ||
    data.canonical_import_id?.toString() !== context.canonicalImportId ||
    data.canonical_payload_hash !== context.payloadHash ||
    !isDeepStrictEqual(data.question_snapshot, context.snapshot)
  ) {
    reportWritingVersionConflict({
      code: "canonical_draft_version_conflict",
      problemId: input.problem_id,
      draftId: input.draft_id,
      questionId: context.questionId,
    });
    throw new Error("canonical_draft_version_conflict");
  }
  return input.draft_id;
}

function shouldDisableExternalWritingApiForE2E(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.E2E_DISABLE_EXTERNAL_WRITING_API === "1"
  );
}

async function fetchSubmitProfileContext(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<{ status: Tables<"profiles">["status"] | null; locale: Locale }> {
  const { data } = await supabase
    .from("profiles")
    .select("status, ui_locale")
    .eq("id", userId)
    .maybeSingle();

  return {
    status: data?.status ?? null,
    locale: asLocale(data?.ui_locale) ?? DEFAULT_LOCALE,
  };
}

export async function submitWritingAction(
  input: SubmitWritingInput,
): Promise<SubmitWritingActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  // 회원 탈퇴(deleted)/차단(blocked) 계정의 쓰기 제출·리포트 생성 차단.
  const profileContext = await fetchSubmitProfileContext(supabase, user.id);
  if (!isActiveStatus(profileContext.status)) {
    redirect(
      `${ACCOUNT_INACTIVE_PATH}?status=${profileContext.status ?? "deleted"}`,
    );
  }

  const submissionControl = await getWritingSubmissionControl({ supabase });
  if (
    submissionControl.submissionMode !== "canonical" ||
    submissionControl.submissionContractState !== "local_outbox_verified"
  ) {
    return {
      rejection: {
        code: "writing_submission_temporarily_blocked",
        message: toSubmitWritingErrorMessage(
          "writing_submission_temporarily_blocked",
        ),
      },
    };
  }
  const intentId = requireSubmissionIntentId(input);
  const canonicalContext = await getCanonicalWritingSubmissionContext({
    supabase,
    questionNo: input.question_no,
    problemId: input.problem_id,
  });
  assertCanonicalRenderVersion({ input, context: canonicalContext });
  const draftId = await assertCanonicalDraftVersion({
    supabase,
    userId: user.id,
    input,
    context: canonicalContext,
  });

  const serviceSupabase = createSupabaseServiceRoleClient();
  const intentPayload = buildWritingSubmissionIntentPayload({
    userId: user.id,
    problemId: input.problem_id,
    draftId,
    parentSubmissionId: input.parent_submission_id ?? null,
    questionNo: input.question_no,
    answerText: input.answer_text,
    answerJson: (input.answer_json ?? null) as Json | null,
    charCount: input.char_count,
    canonicalContext,
  });
  const e2eExternalApiDisabled = shouldDisableExternalWritingApiForE2E();
  const externalBaseUrl = getTalkpikApiBaseUrl();
  if (!externalBaseUrl && !e2eExternalApiDisabled) {
    throw new Error("writing_evaluation_provider_not_configured");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken && !e2eExternalApiDisabled) {
    throw new Error("submitWriting: missing session token");
  }

  const externalPayload = {
    task_type: toExternalTaskType(input.question_no),
    question_id: canonicalContext.questionId,
    text: input.answer_text,
    lang: profileContext.locale,
  };

  const localSubmissionId = await dispatchWritingSubmissionIntent({
    client: serviceSupabase,
    intentId,
    submission: intentPayload,
    dispatchProvider: async () => {
      if (e2eExternalApiDisabled) {
        return {
          externalSubmissionId: `e2e-${intentId}`,
          providerStatus: "failed",
        };
      }
      const external = await submitExternalWriting({
        baseUrl: externalBaseUrl as string,
        accessToken: accessToken as string,
        payload: externalPayload,
      });
      return {
        externalSubmissionId: external.submission_id,
        providerStatus: external.status,
      };
    },
    classifyProviderFailure: (error) => ({
      disposition: isAmbiguousExternalSubmitError(error)
        ? "ambiguous"
        : "failed",
      reasonCode: externalSubmitFailureCode(error),
    }),
    onTransitionError: (error) => {
      console.error("writing_submission_intent_transition_failed", {
        intentIdHash: hashWritingIdentifier(intentId),
        targetState: "ambiguous",
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    },
  });
  return { submissionId: localSubmissionId, questionNo: input.question_no };
}

export type CreateComparisonReportInput = {
  current_id: string;
  previous_id?: string | null;
};

async function getComparisonSubmissionById({
  supabase,
  id,
}: {
  supabase: SupabaseServerClient;
  id: string;
}): Promise<WritingSubmissionRow | null> {
  const { data, error } = await supabase
    .from("writing_submissions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`comparison: previous ${error.message}`);
  return data as WritingSubmissionRow | null;
}

function assertComparablePreviousSubmission({
  currentSub,
  previousSub,
}: {
  currentSub: WritingSubmissionRow;
  previousSub: WritingSubmissionRow;
}): WritingSubmissionRow {
  if (previousSub.id === currentSub.id) {
    throw new Error(
      "comparison: previous submission must differ from current submission",
    );
  }
  if (previousSub.problem_id !== currentSub.problem_id) {
    throw new Error(
      "comparison: previous submission must use the same problem_id as current submission",
    );
  }
  return previousSub;
}

async function resolvePreviousSubmissionForComparison({
  supabase,
  userId,
  currentSub,
  explicitPreviousId,
}: {
  supabase: SupabaseServerClient;
  userId: string;
  currentSub: WritingSubmissionRow;
  explicitPreviousId?: string | null;
}): Promise<WritingSubmissionRow | null> {
  if (explicitPreviousId) {
    const previousSub = await getComparisonSubmissionById({
      supabase,
      id: explicitPreviousId,
    });
    if (!previousSub) {
      throw new Error("comparison: previous submission missing");
    }
    return assertComparablePreviousSubmission({
      currentSub,
      previousSub,
    });
  }

  if (currentSub.parent_submission_id) {
    const { data, error } = await supabase
      .from("writing_submissions")
      .select("*")
      .eq("id", currentSub.parent_submission_id)
      .eq("user_id", userId)
      .eq("problem_id", currentSub.problem_id)
      .maybeSingle();
    if (error) throw new Error(`comparison: parent ${error.message}`);
    if (data) return data as WritingSubmissionRow;
  }

  const { data, error } = await supabase
    .from("writing_submissions")
    .select("*")
    .eq("user_id", userId)
    .eq("problem_id", currentSub.problem_id)
    .eq("feedback_status", "complete")
    .neq("id", currentSub.id)
    .lt("submitted_at", currentSub.submitted_at)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`comparison: previous lookup ${error.message}`);
  return data as WritingSubmissionRow | null;
}

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
  const currentSubmission = currentSub as WritingSubmissionRow;
  const currentQuestionNo = currentSubmission.question_no as QuestionNo;

  const prevSub = await resolvePreviousSubmissionForComparison({
    supabase,
    userId: user.id,
    currentSub: currentSubmission,
    explicitPreviousId: input.previous_id,
  });
  const effectivePreviousId = prevSub?.id ?? null;

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
    prevSub && effectivePreviousId
      ? await Promise.all([
          supabase
            .from("writing_feedback")
            .select("*")
            .eq("submission_id", effectivePreviousId)
            .maybeSingle(),
          supabase
            .from("feedback_dimension_scores")
            .select("*")
            .eq("submission_id", effectivePreviousId),
        ])
      : null;

  const currentBundle: FeedbackBundle | null = curFeedback
    ? {
        feedback: curFeedback as FeedbackBundle["feedback"],
        dimensions: (curDims ?? []) as FeedbackBundle["dimensions"],
        sentences: [],
      }
    : null;
  const previousBundle: FeedbackBundle | null = prev?.[0].data
    ? {
        feedback: prev[0].data as FeedbackBundle["feedback"],
        dimensions: (prev?.[1].data ?? []) as FeedbackBundle["dimensions"],
        sentences: [],
      }
    : null;
  const currentScoreItems = buildComparisonScoreItems(
    currentQuestionNo,
    currentBundle,
  );
  const previousScoreItems = previousBundle
    ? buildComparisonScoreItems(currentQuestionNo, previousBundle)
    : [];

  const metrics = computeComparisonMetrics({
    currentScore: curFeedback?.score_total ?? null,
    currentScoreMax: curFeedback?.score_max ?? null,
    previousScore: prev?.[0].data?.score_total ?? null,
    previousScoreMax: prev?.[0].data?.score_max ?? null,
    currentDims: curDims ?? [],
    previousDims: prev?.[1].data ?? null,
    currentScoreItems: toComparisonMetricScoreItems(currentScoreItems),
    previousScoreItems: previousBundle
      ? toComparisonMetricScoreItems(previousScoreItems)
      : null,
    currentChars: currentSubmission.char_count,
    previousChars: prevSub?.char_count ?? null,
  });
  const narrative = generateNarrative(metrics);

  const { data: reportId, error: rpcErr } = await supabase.rpc(
    "create_comparison_report_with_metrics" as never,
    {
      current_id: input.current_id,
      previous_id: effectivePreviousId,
      metrics: metrics as unknown as Record<string, unknown>,
      narrative,
      ai_model: "comparison-local-v2",
    } as never,
  );
  if (rpcErr) throw new Error(`comparison rpc: ${rpcErr.message}`);
  return { reportId: (reportId as unknown as string) ?? "" };
}

export async function createComparisonReportWithViewAction(
  input: CreateComparisonReportInput,
): Promise<{ reportId: string; viewModel: ComparisonReportViewModel }> {
  const { reportId } = await createComparisonReportAction(input);
  const viewModel = await getComparisonReportViewModel(reportId);
  if (!viewModel) {
    throw new Error("comparison: created report view missing");
  }
  return { reportId, viewModel };
}
