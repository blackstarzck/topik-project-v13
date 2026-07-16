import type { Json } from "../supabase/types";
import type { CanonicalWritingSubmissionContext } from "./canonical-source";
import type { QuestionNo } from "./types";

export type WritingSubmissionIntentState =
  | "pending"
  | "dispatching"
  | "accepted"
  | "materialized"
  | "ambiguous"
  | "failed";

export type WritingSubmissionIntentView = {
  intentId: string;
  state: WritingSubmissionIntentState;
  shouldDispatch: boolean;
  localSubmissionId: string | null;
  externalSubmissionId: string | null;
};

export type WritingSubmissionIntentPayload = {
  user_id: string;
  problem_id: string;
  draft_id: string;
  parent_submission_id: string | null;
  question_no: QuestionNo;
  answer_text: string;
  answer_json: Json | null;
  char_count: number;
  canonical_question_id: string;
  canonical_import_id: string;
  canonical_payload_hash: string;
  question_snapshot: Json;
};

export type WritingProviderDispatchResult = {
  externalSubmissionId: string;
  providerStatus: string;
};

export type WritingProviderFailure = {
  disposition: "ambiguous" | "failed";
  reasonCode: string;
};

type RpcError = { message: string } | null;
type RpcResult = { data: unknown; error: RpcError };

export type WritingSubmissionOutboxClient = {
  rpc: unknown;
};

function invokeRpc(
  client: WritingSubmissionOutboxClient,
  name: string,
  args: Record<string, unknown>,
): Promise<RpcResult> {
  return (
    client.rpc as (
      rpcName: string,
      rpcArgs: Record<string, unknown>,
    ) => Promise<RpcResult>
  )(name, args);
}

function parseIntentView(value: unknown): WritingSubmissionIntentView {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") {
    throw new Error("writing_submission_intent_result_invalid");
  }
  const record = row as Record<string, unknown>;
  const intentId = record.intent_id;
  const state = record.state;
  if (
    typeof intentId !== "string" ||
    ![
      "pending",
      "dispatching",
      "accepted",
      "materialized",
      "ambiguous",
      "failed",
    ].includes(String(state))
  ) {
    throw new Error("writing_submission_intent_result_invalid");
  }
  return {
    intentId,
    state: state as WritingSubmissionIntentState,
    shouldDispatch: record.should_dispatch === true,
    localSubmissionId:
      typeof record.local_submission_id === "string"
        ? record.local_submission_id
        : null,
    externalSubmissionId:
      typeof record.external_submission_id === "string"
        ? record.external_submission_id
        : null,
  };
}

async function callIntentRpc(
  client: WritingSubmissionOutboxClient,
  name: string,
  args: Record<string, unknown>,
): Promise<WritingSubmissionIntentView> {
  const { data, error } = await invokeRpc(client, name, args);
  if (error) throw new Error(`${name}: ${error.message}`);
  return parseIntentView(data);
}

export function buildWritingSubmissionIntentPayload({
  userId,
  problemId,
  draftId,
  parentSubmissionId,
  questionNo,
  answerText,
  answerJson,
  charCount,
  canonicalContext,
}: {
  userId: string;
  problemId: string;
  draftId: string;
  parentSubmissionId: string | null;
  questionNo: QuestionNo;
  answerText: string;
  answerJson: Json | null;
  charCount: number;
  canonicalContext: CanonicalWritingSubmissionContext;
}): WritingSubmissionIntentPayload {
  return {
    user_id: userId,
    problem_id: problemId,
    draft_id: draftId,
    parent_submission_id: parentSubmissionId,
    question_no: questionNo,
    answer_text: answerText,
    answer_json: answerJson,
    char_count: charCount,
    canonical_question_id: canonicalContext.questionId,
    canonical_import_id: canonicalContext.canonicalImportId,
    canonical_payload_hash: canonicalContext.payloadHash,
    question_snapshot: canonicalContext.snapshot as Json,
  };
}

export function prepareWritingSubmissionIntent(
  client: WritingSubmissionOutboxClient,
  intentId: string,
  submission: WritingSubmissionIntentPayload,
) {
  return callIntentRpc(client, "prepare_writing_submission_intent", {
    p_intent_id: intentId,
    p_submission: submission,
  });
}

export function claimWritingSubmissionIntent(
  client: WritingSubmissionOutboxClient,
  intentId: string,
) {
  return callIntentRpc(client, "claim_writing_submission_intent", {
    p_intent_id: intentId,
  });
}

async function transitionWritingSubmissionIntent(
  client: WritingSubmissionOutboxClient,
  name: string,
  args: Record<string, unknown>,
) {
  const { error } = await invokeRpc(client, name, args);
  if (error) throw new Error(`${name}: ${error.message}`);
}

export function markWritingSubmissionIntentAccepted(
  client: WritingSubmissionOutboxClient,
  intentId: string,
  externalSubmissionId: string,
  providerStatus: string,
) {
  return transitionWritingSubmissionIntent(
    client,
    "mark_writing_submission_intent_accepted",
    {
      p_intent_id: intentId,
      p_external_submission_id: externalSubmissionId,
      p_provider_status: providerStatus,
    },
  );
}

export function markWritingSubmissionIntentAmbiguous(
  client: WritingSubmissionOutboxClient,
  intentId: string,
  reasonCode: string,
) {
  return transitionWritingSubmissionIntent(
    client,
    "mark_writing_submission_intent_ambiguous",
    { p_intent_id: intentId, p_reason_code: reasonCode },
  );
}

export function markWritingSubmissionIntentFailed(
  client: WritingSubmissionOutboxClient,
  intentId: string,
  reasonCode: string,
) {
  return transitionWritingSubmissionIntent(
    client,
    "mark_writing_submission_intent_failed",
    { p_intent_id: intentId, p_reason_code: reasonCode },
  );
}

export async function materializeWritingSubmissionIntent(
  client: WritingSubmissionOutboxClient,
  intentId: string,
): Promise<string> {
  const { data, error } = await invokeRpc(
    client,
    "materialize_writing_submission_intent",
    { p_intent_id: intentId },
  );
  if (error) {
    throw new Error(`materialize_writing_submission_intent: ${error.message}`);
  }
  if (typeof data !== "string" || !data) {
    throw new Error("materialize_writing_submission_intent_result_invalid");
  }
  return data;
}

async function resolveExistingIntent(
  client: WritingSubmissionOutboxClient,
  intent: WritingSubmissionIntentView,
): Promise<string | null> {
  if (intent.state === "materialized" && intent.localSubmissionId) {
    return intent.localSubmissionId;
  }
  if (intent.state === "accepted") {
    return materializeWritingSubmissionIntent(client, intent.intentId);
  }
  if (intent.state === "dispatching" && intent.shouldDispatch) {
    return null;
  }
  if (intent.state === "dispatching" || intent.state === "ambiguous") {
    throw new Error("writing_submission_dispatch_ambiguous");
  }
  if (intent.state === "failed") {
    throw new Error("writing_submission_dispatch_failed");
  }
  return null;
}

async function markAmbiguousBestEffort(
  client: WritingSubmissionOutboxClient,
  intentId: string,
  reasonCode: string,
  onTransitionError?: (error: unknown) => void,
) {
  try {
    await markWritingSubmissionIntentAmbiguous(client, intentId, reasonCode);
  } catch (error) {
    onTransitionError?.(error);
  }
}

export async function dispatchWritingSubmissionIntent({
  client,
  intentId,
  submission,
  dispatchProvider,
  classifyProviderFailure,
  onTransitionError,
}: {
  client: WritingSubmissionOutboxClient;
  intentId: string;
  submission: WritingSubmissionIntentPayload;
  dispatchProvider: () => Promise<WritingProviderDispatchResult>;
  classifyProviderFailure: (error: unknown) => WritingProviderFailure;
  onTransitionError?: (error: unknown) => void;
}): Promise<string> {
  const prepared = await prepareWritingSubmissionIntent(
    client,
    intentId,
    submission,
  );
  const preparedSubmissionId = await resolveExistingIntent(client, prepared);
  if (preparedSubmissionId) return preparedSubmissionId;

  const claimed = await claimWritingSubmissionIntent(client, prepared.intentId);
  const claimedSubmissionId = await resolveExistingIntent(client, claimed);
  if (claimedSubmissionId) return claimedSubmissionId;
  if (!claimed.shouldDispatch) {
    throw new Error("writing_submission_intent_not_dispatchable");
  }

  let providerResult: WritingProviderDispatchResult;
  try {
    providerResult = await dispatchProvider();
  } catch (error) {
    const failure = classifyProviderFailure(error);
    if (failure.disposition === "ambiguous") {
      await markAmbiguousBestEffort(
        client,
        claimed.intentId,
        failure.reasonCode,
        onTransitionError,
      );
      throw new Error("writing_submission_dispatch_ambiguous");
    }
    try {
      await markWritingSubmissionIntentFailed(
        client,
        claimed.intentId,
        failure.reasonCode,
      );
    } catch {
      await markAmbiguousBestEffort(
        client,
        claimed.intentId,
        "provider_failure_persistence_unknown",
        onTransitionError,
      );
      throw new Error("writing_submission_dispatch_ambiguous");
    }
    throw new Error("writing_submission_dispatch_failed");
  }

  try {
    await markWritingSubmissionIntentAccepted(
      client,
      claimed.intentId,
      providerResult.externalSubmissionId,
      providerResult.providerStatus,
    );
  } catch {
    await markAmbiguousBestEffort(
      client,
      claimed.intentId,
      "provider_accepted_persistence_unknown",
      onTransitionError,
    );
    throw new Error("writing_submission_dispatch_ambiguous");
  }

  return materializeWritingSubmissionIntent(client, claimed.intentId);
}
