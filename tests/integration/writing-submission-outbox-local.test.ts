import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { assertLocalPrivilegedMutationTarget } from "../../scripts/lib/supabase-target-safety.mjs";
import {
  buildWritingSubmissionIntentPayload,
  dispatchWritingSubmissionIntent,
  prepareWritingSubmissionIntent,
  type WritingSubmissionIntentPayload,
  type WritingSubmissionOutboxClient,
} from "../../src/lib/writing/submission-outbox";
import type { CanonicalWritingSubmissionContext } from "../../src/lib/writing/canonical-source";
import type { Json } from "../../src/lib/supabase/types";

const ENABLED = process.env.SUPABASE_LOCAL_STACK === "1";

if (ENABLED) {
  assertLocalPrivilegedMutationTarget(process.env);
}

type CanonicalRow = {
  canonical_import_id: number | string;
  difficulty: number | null;
  item_number: number;
  materials: Json | null;
  payload_hash: string;
  problem_id: string;
  prompt: string;
  question_id: string;
  tags: string[] | null;
  title: string;
  topik_level: number;
};

function canonicalContext(
  row: CanonicalRow,
): CanonicalWritingSubmissionContext {
  const canonicalImportId = String(row.canonical_import_id);
  return {
    canonicalImportId,
    payloadHash: row.payload_hash,
    questionId: row.question_id,
    snapshot: {
      canonical_import_id: canonicalImportId,
      difficulty: row.difficulty,
      item_number: row.item_number as 51 | 52 | 53 | 54,
      materials: row.materials,
      payload_hash: row.payload_hash,
      prompt: row.prompt,
      question_id: row.question_id,
      tags: row.tags ?? [],
      title: row.title,
      topik_level: row.topik_level,
    },
  };
}

function asOutboxClient(client: {
  rpc: unknown;
}): WritingSubmissionOutboxClient {
  return client;
}

function withOneRpcResponseLoss(
  client: { rpc: (name: string, args: Record<string, unknown>) => unknown },
  rpcName: string,
): WritingSubmissionOutboxClient {
  let pending = true;
  return {
    rpc: async (name: string, args: Record<string, unknown>) => {
      if (pending && name === rpcName) {
        pending = false;
        return {
          data: null,
          error: { message: "simulated local response loss" },
        };
      }
      return client.rpc(name, args);
    },
  };
}

const classifyProviderFailure = (error: unknown) => ({
  disposition:
    error instanceof TypeError ? ("ambiguous" as const) : ("failed" as const),
  reasonCode:
    error instanceof TypeError ? "provider_network_error" : "provider_http_400",
});

describe.skipIf(!ENABLED)("writing submission outbox (local stack)", () => {
  it("deduplicates dispatch, quarantines timeouts, and recovers accepted materialization without redispatch", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const publicKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const publicClient = createClient(url, publicKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const serviceClient = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    let userId: string | undefined;
    let verificationOpened = false;
    const cleanupErrors: unknown[] = [];

    async function setSubmissionMode(mode: "blocked" | "verification") {
      const { error } = await serviceClient.rpc(
        "set_writing_submission_state" as never,
        {
          p_actor: "local-outbox-integration",
          p_evidence_id: null,
          p_reason: `local outbox ${mode}`,
          p_submission_contract_state: "unverified",
          p_submission_mode: mode,
        } as never,
      );
      if (error) throw error;
    }

    async function createDraftPayload(
      row: CanonicalRow,
      answer: string,
    ): Promise<WritingSubmissionIntentPayload> {
      const draftId = randomUUID();
      const context = canonicalContext(row);
      const { error } = await serviceClient.from("writing_drafts").insert({
        answer_json: null,
        answer_text: answer,
        autosave_status: "clean",
        canonical_import_id: Number(row.canonical_import_id),
        canonical_payload_hash: row.payload_hash,
        canonical_question_id: row.question_id,
        char_count: answer.length,
        id: draftId,
        last_saved_at: new Date().toISOString(),
        problem_id: row.problem_id,
        question_no: row.item_number,
        question_snapshot: context.snapshot,
        user_id: userId!,
      });
      if (error) throw error;
      return buildWritingSubmissionIntentPayload({
        answerJson: null,
        answerText: answer,
        canonicalContext: context,
        charCount: answer.length,
        draftId,
        parentSubmissionId: null,
        problemId: row.problem_id,
        questionNo: row.item_number as 51 | 52 | 53 | 54,
        userId: userId!,
      });
    }

    try {
      const { data: signup, error: signupError } =
        await publicClient.auth.signUp({
          email: `outbox-local+${randomUUID()}@example.com`,
          password: `Local-${randomUUID()}-Aa1!`,
        });
      if (signupError || !signup.user) throw signupError ?? new Error("signup");
      userId = signup.user.id;

      const { data: canonicalData, error: canonicalError } =
        await publicClient.rpc("get_available_writing_questions", {
          p_item_number: 52,
          p_problem_id: null,
        });
      if (canonicalError) throw canonicalError;
      const rows = (canonicalData ?? []) as CanonicalRow[];
      expect(rows.length).toBeGreaterThanOrEqual(3);

      await setSubmissionMode("verification");
      verificationOpened = true;
      const outboxClient = asOutboxClient(serviceClient);

      const duplicatePayload = await createDraftPayload(
        rows[0],
        "Local concurrent outbox answer.",
      );
      const duplicateProvider = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return {
          externalSubmissionId: `local-${randomUUID()}`,
          providerStatus: "processing",
        };
      });
      const duplicateResults = await Promise.allSettled([
        dispatchWritingSubmissionIntent({
          classifyProviderFailure,
          client: outboxClient,
          dispatchProvider: duplicateProvider,
          intentId: randomUUID(),
          submission: duplicatePayload,
        }),
        dispatchWritingSubmissionIntent({
          classifyProviderFailure,
          client: outboxClient,
          dispatchProvider: duplicateProvider,
          intentId: randomUUID(),
          submission: duplicatePayload,
        }),
      ]);
      expect(duplicateProvider).toHaveBeenCalledTimes(1);
      expect(
        duplicateResults.some((result) => result.status === "fulfilled"),
      ).toBe(true);

      const timeoutPayload = await createDraftPayload(
        rows[1],
        "Local timeout quarantine answer.",
      );
      const timeoutIntent = randomUUID();
      const timeoutProvider = vi.fn(async () => {
        throw new TypeError("simulated timeout");
      });
      await expect(
        dispatchWritingSubmissionIntent({
          classifyProviderFailure,
          client: outboxClient,
          dispatchProvider: timeoutProvider,
          intentId: timeoutIntent,
          submission: timeoutPayload,
        }),
      ).rejects.toThrow("writing_submission_dispatch_ambiguous");
      await expect(
        dispatchWritingSubmissionIntent({
          classifyProviderFailure,
          client: outboxClient,
          dispatchProvider: timeoutProvider,
          intentId: timeoutIntent,
          submission: timeoutPayload,
        }),
      ).rejects.toThrow("writing_submission_dispatch_ambiguous");
      expect(timeoutProvider).toHaveBeenCalledTimes(1);
      await expect(
        prepareWritingSubmissionIntent(
          outboxClient,
          timeoutIntent,
          timeoutPayload,
        ),
      ).resolves.toMatchObject({ state: "ambiguous" });

      const recoveryPayload = await createDraftPayload(
        rows[2],
        "Local accepted materialization recovery answer.",
      );
      const recoveryIntent = randomUUID();
      const recoveryProvider = vi.fn(async () => ({
        externalSubmissionId: `local-${randomUUID()}`,
        providerStatus: "processing",
      }));
      await expect(
        dispatchWritingSubmissionIntent({
          classifyProviderFailure,
          client: withOneRpcResponseLoss(
            serviceClient as unknown as {
              rpc: (name: string, args: Record<string, unknown>) => unknown;
            },
            "materialize_writing_submission_intent",
          ),
          dispatchProvider: recoveryProvider,
          intentId: recoveryIntent,
          submission: recoveryPayload,
        }),
      ).rejects.toThrow("simulated local response loss");
      await expect(
        dispatchWritingSubmissionIntent({
          classifyProviderFailure,
          client: outboxClient,
          dispatchProvider: recoveryProvider,
          intentId: recoveryIntent,
          submission: recoveryPayload,
        }),
      ).resolves.toBe(recoveryIntent);
      expect(recoveryProvider).toHaveBeenCalledTimes(1);
    } finally {
      if (verificationOpened) {
        try {
          await setSubmissionMode("blocked");
        } catch (error) {
          cleanupErrors.push(error);
        }
      }
      if (userId) {
        const { error } = await serviceClient.auth.admin.deleteUser(userId);
        if (error) cleanupErrors.push(error);
      }
      if (cleanupErrors.length > 0) {
        throw new AggregateError(cleanupErrors, "local outbox cleanup failed");
      }
    }
  }, 120_000);
});
