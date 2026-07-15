import { describe, expect, it, vi } from "vitest";
import {
  dispatchWritingSubmissionIntent,
  type WritingSubmissionIntentPayload,
} from "../../../src/lib/writing/submission-outbox";

const INTENT_ID = "11111111-1111-4111-8111-111111111111";
const LOCAL_ID = INTENT_ID;

const submission: WritingSubmissionIntentPayload = {
  user_id: "22222222-2222-4222-8222-222222222222",
  problem_id: "33333333-3333-4333-8333-333333333333",
  draft_id: "44444444-4444-4444-8444-444444444444",
  parent_submission_id: null,
  question_no: 54,
  answer_text: "환경 보호를 위한 답안",
  answer_json: null,
  char_count: 14,
  canonical_question_id: "topik-writing-54-0001",
  canonical_import_id: "701",
  canonical_payload_hash: "payload-hash-701",
  question_snapshot: {
    question_id: "topik-writing-54-0001",
    canonical_import_id: "701",
    payload_hash: "payload-hash-701",
    item_number: 54,
  },
};

function view(
  state: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    intent_id: INTENT_ID,
    state,
    should_dispatch: false,
    local_submission_id: null,
    external_submission_id: null,
    ...overrides,
  };
}

function clientWithRpc(
  handler: (name: string, args: Record<string, unknown>) => unknown,
) {
  return {
    rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
      const result = handler(name, args);
      if (result instanceof Error) {
        return { data: null, error: { message: result.message } };
      }
      return { data: result ?? null, error: null };
    }),
  };
}

const classifyFailure = (error: unknown) => ({
  disposition: error instanceof TypeError ? ("ambiguous" as const) : ("failed" as const),
  reasonCode: error instanceof TypeError ? "provider_network_error" : "provider_http_400",
});

describe("dispatchWritingSubmissionIntent", () => {
  it("persists the intent before dispatch and materializes with a separate provider id", async () => {
    const calls: string[] = [];
    const client = clientWithRpc((name) => {
      calls.push(name);
      if (name === "prepare_writing_submission_intent") return view("pending");
      if (name === "claim_writing_submission_intent") {
        return view("dispatching", { should_dispatch: true });
      }
      if (name === "materialize_writing_submission_intent") return LOCAL_ID;
      return null;
    });
    const dispatchProvider = vi.fn().mockResolvedValue({
      externalSubmissionId: "provider-submission-string-id",
      providerStatus: "processing",
    });

    await expect(
      dispatchWritingSubmissionIntent({
        client,
        intentId: INTENT_ID,
        submission,
        dispatchProvider,
        classifyProviderFailure: classifyFailure,
      }),
    ).resolves.toBe(LOCAL_ID);

    expect(calls).toEqual([
      "prepare_writing_submission_intent",
      "claim_writing_submission_intent",
      "mark_writing_submission_intent_accepted",
      "materialize_writing_submission_intent",
    ]);
    expect(dispatchProvider).toHaveBeenCalledTimes(1);
    expect(client.rpc).toHaveBeenCalledWith(
      "mark_writing_submission_intent_accepted",
      expect.objectContaining({
        p_external_submission_id: "provider-submission-string-id",
      }),
    );
  });

  it("returns an already materialized intent without calling the provider", async () => {
    const client = clientWithRpc((name) => {
      if (name === "prepare_writing_submission_intent") {
        return view("materialized", { local_submission_id: LOCAL_ID });
      }
      throw new Error(`unexpected ${name}`);
    });
    const dispatchProvider = vi.fn();

    await expect(
      dispatchWritingSubmissionIntent({
        client,
        intentId: INTENT_ID,
        submission,
        dispatchProvider,
        classifyProviderFailure: classifyFailure,
      }),
    ).resolves.toBe(LOCAL_ID);
    expect(dispatchProvider).not.toHaveBeenCalled();
  });

  it("allows only one provider dispatch across concurrent duplicate requests", async () => {
    let state = "pending";
    const client = clientWithRpc((name) => {
      if (name === "prepare_writing_submission_intent") {
        return view(state, {
          local_submission_id: state === "materialized" ? LOCAL_ID : null,
        });
      }
      if (name === "claim_writing_submission_intent") {
        if (state === "pending") {
          state = "dispatching";
          return view(state, { should_dispatch: true });
        }
        return view(state);
      }
      if (name === "mark_writing_submission_intent_accepted") {
        state = "accepted";
        return null;
      }
      if (name === "materialize_writing_submission_intent") {
        state = "materialized";
        return LOCAL_ID;
      }
      throw new Error(`unexpected ${name}`);
    });
    const dispatchProvider = vi.fn().mockResolvedValue({
      externalSubmissionId: "provider-concurrent-id",
      providerStatus: "processing",
    });

    const results = await Promise.allSettled([
      dispatchWritingSubmissionIntent({
        client,
        intentId: INTENT_ID,
        submission,
        dispatchProvider,
        classifyProviderFailure: classifyFailure,
      }),
      dispatchWritingSubmissionIntent({
        client,
        intentId: INTENT_ID,
        submission,
        dispatchProvider,
        classifyProviderFailure: classifyFailure,
      }),
    ]);

    expect(dispatchProvider).toHaveBeenCalledTimes(1);
    expect(results.some((result) => result.status === "fulfilled")).toBe(true);
  });

  it("recovers accepted-provider/local-write failure without redispatching", async () => {
    const client = clientWithRpc((name) => {
      if (name === "prepare_writing_submission_intent") return view("accepted");
      if (name === "materialize_writing_submission_intent") return LOCAL_ID;
      throw new Error(`unexpected ${name}`);
    });
    const dispatchProvider = vi.fn();

    await expect(
      dispatchWritingSubmissionIntent({
        client,
        intentId: INTENT_ID,
        submission,
        dispatchProvider,
        classifyProviderFailure: classifyFailure,
      }),
    ).resolves.toBe(LOCAL_ID);
    expect(dispatchProvider).not.toHaveBeenCalled();
  });

  it.each(["dispatching", "ambiguous"])(
    "never redispatches an intent in %s state",
    async (state) => {
      const client = clientWithRpc((name) => {
        if (name === "prepare_writing_submission_intent") return view(state);
        throw new Error(`unexpected ${name}`);
      });
      const dispatchProvider = vi.fn();

      await expect(
        dispatchWritingSubmissionIntent({
          client,
          intentId: INTENT_ID,
          submission,
          dispatchProvider,
          classifyProviderFailure: classifyFailure,
        }),
      ).rejects.toThrow("writing_submission_dispatch_ambiguous");
      expect(dispatchProvider).not.toHaveBeenCalled();
    },
  );

  it("marks a timeout/network result ambiguous and does not materialize", async () => {
    const client = clientWithRpc((name) => {
      if (name === "prepare_writing_submission_intent") return view("pending");
      if (name === "claim_writing_submission_intent") {
        return view("dispatching", { should_dispatch: true });
      }
      return null;
    });

    await expect(
      dispatchWritingSubmissionIntent({
        client,
        intentId: INTENT_ID,
        submission,
        dispatchProvider: vi.fn().mockRejectedValue(new TypeError("timeout")),
        classifyProviderFailure: classifyFailure,
      }),
    ).rejects.toThrow("writing_submission_dispatch_ambiguous");
    expect(client.rpc).toHaveBeenCalledWith(
      "mark_writing_submission_intent_ambiguous",
      expect.objectContaining({ p_reason_code: "provider_network_error" }),
    );
    expect(client.rpc).not.toHaveBeenCalledWith(
      "materialize_writing_submission_intent",
      expect.anything(),
    );
  });

  it("records a deterministic provider rejection as failed", async () => {
    const providerError = new Error("bad request");
    const client = clientWithRpc((name) => {
      if (name === "prepare_writing_submission_intent") return view("pending");
      if (name === "claim_writing_submission_intent") {
        return view("dispatching", { should_dispatch: true });
      }
      return null;
    });

    await expect(
      dispatchWritingSubmissionIntent({
        client,
        intentId: INTENT_ID,
        submission,
        dispatchProvider: vi.fn().mockRejectedValue(providerError),
        classifyProviderFailure: classifyFailure,
      }),
    ).rejects.toBe(providerError);
    expect(client.rpc).toHaveBeenCalledWith(
      "mark_writing_submission_intent_failed",
      expect.objectContaining({ p_reason_code: "provider_http_400" }),
    );
  });

  it("quarantines provider success when the accepted marker cannot be saved", async () => {
    const client = clientWithRpc((name) => {
      if (name === "prepare_writing_submission_intent") return view("pending");
      if (name === "claim_writing_submission_intent") {
        return view("dispatching", { should_dispatch: true });
      }
      if (name === "mark_writing_submission_intent_accepted") {
        return new Error("database unavailable");
      }
      return null;
    });
    const dispatchProvider = vi.fn().mockResolvedValue({
      externalSubmissionId: "provider-accepted-id",
      providerStatus: "processing",
    });

    await expect(
      dispatchWritingSubmissionIntent({
        client,
        intentId: INTENT_ID,
        submission,
        dispatchProvider,
        classifyProviderFailure: classifyFailure,
      }),
    ).rejects.toThrow("writing_submission_dispatch_ambiguous");
    expect(dispatchProvider).toHaveBeenCalledTimes(1);
    expect(client.rpc).toHaveBeenCalledWith(
      "mark_writing_submission_intent_ambiguous",
      expect.objectContaining({
        p_reason_code: "provider_accepted_persistence_unknown",
      }),
    );
  });
});
