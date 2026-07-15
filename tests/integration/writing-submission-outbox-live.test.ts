import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  buildWritingSubmissionIntentPayload,
  dispatchWritingSubmissionIntent,
  prepareWritingSubmissionIntent,
  type WritingSubmissionIntentPayload,
  type WritingSubmissionOutboxClient,
} from "../../src/lib/writing/submission-outbox";
import type { CanonicalWritingSubmissionContext } from "../../src/lib/writing/canonical-source";
import type { Json } from "../../src/lib/supabase/types";

const LIVE = process.env.E2E_OUTBOX_LIVE === "1";
const SAFE_ENV_LABELS = new Set([
  "dev",
  "development",
  "local",
  "preview",
  "qa",
  "staging",
  "test",
  "testing",
]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OUTBOX_CONTRACT =
  "writing-outbox-v2|prepare|claim-once|accepted-recovery|ambiguous-no-retry|confirmed-failure-new-intent|external-text-id|local-intent-uuid";
const OUTBOX_CONTRACT_DIGEST = createHash("sha256")
  .update(OUTBOX_CONTRACT)
  .digest("hex");

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

type LiveConfig = {
  anonKey: string;
  expectedProjectRef: string;
  managementToken: string;
  reportPath: string;
  serviceRoleKey: string;
  studentEmail: string;
  studentPassword: string;
  supabaseUrl: string;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for live outbox verification.`);
  return value;
}

function resolveLiveConfig(): LiveConfig {
  if (!LIVE) throw new Error("E2E_OUTBOX_LIVE=1 is required.");
  if (process.env.E2E_ALLOW_DEV_DB_MUTATION !== "1") {
    throw new Error("E2E_ALLOW_DEV_DB_MUTATION=1 is required.");
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Live outbox verification refuses NODE_ENV=production.");
  }
  const label = required("SUPABASE_ENV_LABEL").toLowerCase();
  if (!SAFE_ENV_LABELS.has(label)) {
    throw new Error(`SUPABASE_ENV_LABEL is not non-production: ${label}`);
  }

  const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL");
  const actualProjectRef = new URL(supabaseUrl).hostname.replace(
    /\.supabase\.co$/,
    "",
  );
  const expectedProjectRef = required("E2E_EXPECTED_SUPABASE_PROJECT_REF");
  if (
    actualProjectRef !== expectedProjectRef ||
    required("SUPABASE_PROJECT_REF") !== expectedProjectRef
  ) {
    throw new Error("Live outbox verification project-ref guard failed.");
  }

  return {
    anonKey:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
      required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    expectedProjectRef,
    managementToken: required("SUPABASE_ACCESS_TOKEN"),
    reportPath: required("OUTBOX_EVIDENCE_REPORT_PATH"),
    serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    studentEmail: required("E2E_STUDENT_EMAIL"),
    studentPassword:
      process.env.E2E_STUDENT_PASSWORD?.trim() ||
      required("SUPABASE_TEST_PASSWORD"),
    supabaseUrl,
  };
}

function client(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

async function managementSql(
  config: LiveConfig,
  sql: string,
): Promise<Array<Record<string, unknown>>> {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${config.expectedProjectRef}/database/query`,
    {
      body: JSON.stringify({ query: sql }),
      headers: {
        Authorization: `Bearer ${config.managementToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );
  if (!response.ok) {
    throw new Error(
      `Supabase Management SQL failed (${response.status}): ${await response.text()}`,
    );
  }
  return (await response.json()) as Array<Record<string, unknown>>;
}

function uuidArray(ids: string[]): string {
  if (ids.some((id) => !UUID_PATTERN.test(id))) {
    throw new Error("Live outbox cleanup received a non-UUID identifier.");
  }
  if (ids.length === 0) return "array[]::uuid[]";
  return `array[${ids.map((id) => `'${id}'::uuid`).join(",")}]`;
}

function canonicalContext(row: CanonicalRow): CanonicalWritingSubmissionContext {
  const canonicalImportId = String(row.canonical_import_id);
  return {
    canonicalImportId,
    payloadHash: row.payload_hash,
    questionId: row.question_id,
    snapshot: {
      canonical_import_id: canonicalImportId,
      difficulty: row.difficulty,
      item_number: 54,
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

async function createDraftAndPayload({
  answer,
  row,
  serviceClient,
  userId,
}: {
  answer: string;
  row: CanonicalRow;
  serviceClient: SupabaseClient;
  userId: string;
}): Promise<{ draftId: string; payload: WritingSubmissionIntentPayload }> {
  const draftId = randomUUID();
  const context = canonicalContext(row);
  const inserted = await serviceClient
    .from("writing_drafts")
    .insert({
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
      question_no: 54,
      question_snapshot: context.snapshot,
      user_id: userId,
    })
    .select(
      "id,canonical_question_id,canonical_import_id,canonical_payload_hash,question_snapshot",
    )
    .single();
  if (inserted.error) {
    throw new Error(`live outbox draft insert: ${inserted.error.message}`);
  }

  return {
    draftId,
    payload: buildWritingSubmissionIntentPayload({
      answerJson: null,
      answerText: answer,
      canonicalContext: {
        canonicalImportId: String(inserted.data.canonical_import_id),
        payloadHash: String(inserted.data.canonical_payload_hash),
        questionId: String(inserted.data.canonical_question_id),
        snapshot: inserted.data
          .question_snapshot as CanonicalWritingSubmissionContext["snapshot"],
      },
      charCount: answer.length,
      draftId,
      parentSubmissionId: null,
      problemId: row.problem_id,
      questionNo: 54,
      userId,
    }),
  };
}

function rpcClient(serviceClient: SupabaseClient): WritingSubmissionOutboxClient {
  return serviceClient as unknown as WritingSubmissionOutboxClient;
}

function withRpcFault(
  serviceClient: SupabaseClient,
  fault: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }> | null,
): WritingSubmissionOutboxClient {
  return {
    rpc: async (name: string, args: Record<string, unknown>) => {
      const result = fault(name, args);
      if (result) return result;
      return serviceClient.rpc(name, args);
    },
  };
}

const classifyProviderFailure = (error: unknown) => ({
  disposition: error instanceof TypeError ? ("ambiguous" as const) : ("failed" as const),
  reasonCode:
    error instanceof TypeError ? "provider_network_error" : "provider_http_400",
});

async function setSubmissionState(
  serviceClient: SupabaseClient,
  mode: "blocked" | "verification",
  reason: string,
): Promise<void> {
  const result = await serviceClient.rpc("set_writing_submission_state", {
    p_actor: "codex-dev-outbox-verifier",
    p_evidence_id: null,
    p_reason: reason,
    p_submission_contract_state: "unverified",
    p_submission_mode: mode,
  });
  if (result.error) {
    throw new Error(`set_writing_submission_state(${mode}): ${result.error.message}`);
  }
}

async function cleanupRun(
  config: LiveConfig,
  draftIds: string[],
  intentIds: string[],
): Promise<void> {
  const submissionIds = intentIds;
  await managementSql(
    config,
    `begin;
     delete from public.feedback_dimension_scores where submission_id = any(${uuidArray(submissionIds)});
     delete from public.sentence_feedback where submission_id = any(${uuidArray(submissionIds)});
     delete from public.writing_feedback where submission_id = any(${uuidArray(submissionIds)});
     delete from public.writing_submission_metrics where submission_id = any(${uuidArray(submissionIds)});
     delete from public.library_items where submission_id = any(${uuidArray(submissionIds)});
     delete from public.writing_submissions where id = any(${uuidArray(submissionIds)});
     delete from private.writing_submission_intent_audit where intent_id = any(${uuidArray(intentIds)});
     delete from private.writing_submission_intents where intent_id = any(${uuidArray(intentIds)});
     delete from public.writing_drafts where id = any(${uuidArray(draftIds)});
     commit;`,
  );
}

describe.runIf(LIVE)("writing submission outbox live fault verification", () => {
  it("contains duplicate, timeout, persistence, and recovery failures in dev", async () => {
    const config = resolveLiveConfig();
    const serviceClient = client(config.supabaseUrl, config.serviceRoleKey);
    const studentClient = client(config.supabaseUrl, config.anonKey);
    const draftIds: string[] = [];
    const intentIds: string[] = [];
    let cleanupComplete = false;
    let verificationOpened = false;

    try {
      const signIn = await studentClient.auth.signInWithPassword({
        email: config.studentEmail,
        password: config.studentPassword,
      });
      if (signIn.error || !signIn.data.user) {
        throw new Error(`live outbox student sign-in: ${signIn.error?.message}`);
      }
      const userId = signIn.data.user.id;

      const canonical = await studentClient.rpc("get_available_writing_questions", {
        p_item_number: 54,
        p_problem_id: null,
      });
      if (canonical.error) {
        throw new Error(`live outbox canonical lookup: ${canonical.error.message}`);
      }
      const rows = (canonical.data ?? []) as CanonicalRow[];
      const problemIds = rows.map((row) => row.problem_id);
      const [existingDrafts, existingSubmissions] = await Promise.all([
        serviceClient
          .from("writing_drafts")
          .select("problem_id")
          .eq("user_id", userId)
          .in("problem_id", problemIds),
        serviceClient
          .from("writing_submissions")
          .select("problem_id")
          .eq("user_id", userId)
          .in("problem_id", problemIds),
      ]);
      if (existingDrafts.error || existingSubmissions.error) {
        throw new Error("live outbox existing problem lookup failed");
      }
      const occupied = new Set(
        [...(existingDrafts.data ?? []), ...(existingSubmissions.data ?? [])].map(
          (row) => String(row.problem_id),
        ),
      );
      const samples = rows.filter((row) => !occupied.has(row.problem_id)).slice(0, 5);
      if (samples.length !== 5) {
        throw new Error("Live outbox verification requires five unused Q54 questions.");
      }

      await setSubmissionState(
        serviceClient,
        "verification",
        "open service-only live outbox fault verification",
      );
      verificationOpened = true;
      const realClient = rpcClient(serviceClient);
      const scenarios: Record<string, Record<string, boolean | number>> = {};

      const concurrentDraft = await createDraftAndPayload({
        answer: "Live outbox concurrent duplicate verification answer.",
        row: samples[0],
        serviceClient,
        userId,
      });
      draftIds.push(concurrentDraft.draftId);
      const concurrentIntentA = randomUUID();
      const concurrentIntentB = randomUUID();
      intentIds.push(concurrentIntentA, concurrentIntentB);
      let concurrentDispatches = 0;
      const concurrentProvider = async () => {
        concurrentDispatches += 1;
        await new Promise((resolve) => setTimeout(resolve, 30));
        return {
          externalSubmissionId: `dev-fault-${randomUUID()}`,
          providerStatus: "processing",
        };
      };
      const concurrentResults = await Promise.allSettled([
        dispatchWritingSubmissionIntent({
          classifyProviderFailure,
          client: realClient,
          dispatchProvider: concurrentProvider,
          intentId: concurrentIntentA,
          submission: concurrentDraft.payload,
        }),
        dispatchWritingSubmissionIntent({
          classifyProviderFailure,
          client: realClient,
          dispatchProvider: concurrentProvider,
          intentId: concurrentIntentB,
          submission: concurrentDraft.payload,
        }),
      ]);
      expect(concurrentDispatches).toBe(1);
      expect(concurrentResults.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      scenarios.concurrentDuplicate = {
        oneFulfilled: true,
        providerDispatches: concurrentDispatches,
      };

      const timeoutDraft = await createDraftAndPayload({
        answer: "Live outbox timeout verification answer.",
        row: samples[1],
        serviceClient,
        userId,
      });
      draftIds.push(timeoutDraft.draftId);
      const timeoutIntent = randomUUID();
      intentIds.push(timeoutIntent);
      let timeoutDispatches = 0;
      await expect(
        dispatchWritingSubmissionIntent({
          classifyProviderFailure,
          client: realClient,
          dispatchProvider: async () => {
            timeoutDispatches += 1;
            throw new TypeError("simulated timeout");
          },
          intentId: timeoutIntent,
          submission: timeoutDraft.payload,
        }),
      ).rejects.toThrow("writing_submission_dispatch_ambiguous");
      await expect(
        dispatchWritingSubmissionIntent({
          classifyProviderFailure,
          client: realClient,
          dispatchProvider: async () => {
            timeoutDispatches += 1;
            throw new Error("must not redispatch");
          },
          intentId: timeoutIntent,
          submission: timeoutDraft.payload,
        }),
      ).rejects.toThrow("writing_submission_dispatch_ambiguous");
      expect(timeoutDispatches).toBe(1);
      expect((await prepareWritingSubmissionIntent(realClient, timeoutIntent, timeoutDraft.payload)).state).toBe("ambiguous");
      scenarios.timeout = { providerDispatches: timeoutDispatches, quarantined: true };

      const failedDraft = await createDraftAndPayload({
        answer: "Live outbox deterministic failure verification answer.",
        row: samples[2],
        serviceClient,
        userId,
      });
      draftIds.push(failedDraft.draftId);
      const failedIntent = randomUUID();
      intentIds.push(failedIntent);
      let failedDispatches = 0;
      await expect(
        dispatchWritingSubmissionIntent({
          classifyProviderFailure,
          client: realClient,
          dispatchProvider: async () => {
            failedDispatches += 1;
            throw new Error("simulated provider 400");
          },
          intentId: failedIntent,
          submission: failedDraft.payload,
        }),
      ).rejects.toThrow("writing_submission_dispatch_failed");
      expect((await prepareWritingSubmissionIntent(realClient, failedIntent, failedDraft.payload)).state).toBe("failed");

      const retryIntent = randomUUID();
      intentIds.push(retryIntent);
      await dispatchWritingSubmissionIntent({
        classifyProviderFailure,
        client: realClient,
        dispatchProvider: async () => {
          failedDispatches += 1;
          return {
            externalSubmissionId: `dev-retry-${randomUUID()}`,
            providerStatus: "processing",
          };
        },
        intentId: retryIntent,
        submission: failedDraft.payload,
      });
      await dispatchWritingSubmissionIntent({
        classifyProviderFailure,
        client: realClient,
        dispatchProvider: async () => {
          failedDispatches += 1;
          throw new Error("must not redispatch a materialized retry");
        },
        intentId: retryIntent,
        submission: failedDraft.payload,
      });
      expect(failedDispatches).toBe(2);
      scenarios.deterministicFailure = {
        failed: true,
        providerDispatches: failedDispatches,
        retrySucceededWithNewIntent: true,
      };

      const acceptedMarkerDraft = await createDraftAndPayload({
        answer: "Live outbox accepted marker persistence verification answer.",
        row: samples[3],
        serviceClient,
        userId,
      });
      draftIds.push(acceptedMarkerDraft.draftId);
      const acceptedMarkerIntent = randomUUID();
      intentIds.push(acceptedMarkerIntent);
      let acceptedMarkerDispatches = 0;
      const acceptedMarkerFault = withRpcFault(serviceClient, (name) =>
        name === "mark_writing_submission_intent_accepted"
          ? Promise.resolve({ data: null, error: { message: "simulated persistence outage" } })
          : null,
      );
      await expect(
        dispatchWritingSubmissionIntent({
          classifyProviderFailure,
          client: acceptedMarkerFault,
          dispatchProvider: async () => {
            acceptedMarkerDispatches += 1;
            return {
              externalSubmissionId: `dev-fault-${randomUUID()}`,
              providerStatus: "processing",
            };
          },
          intentId: acceptedMarkerIntent,
          submission: acceptedMarkerDraft.payload,
        }),
      ).rejects.toThrow("writing_submission_dispatch_ambiguous");
      await expect(
        dispatchWritingSubmissionIntent({
          classifyProviderFailure,
          client: realClient,
          dispatchProvider: async () => {
            acceptedMarkerDispatches += 1;
            throw new Error("must not redispatch");
          },
          intentId: acceptedMarkerIntent,
          submission: acceptedMarkerDraft.payload,
        }),
      ).rejects.toThrow("writing_submission_dispatch_ambiguous");
      expect(acceptedMarkerDispatches).toBe(1);
      scenarios.acceptedMarkerFailure = {
        providerDispatches: acceptedMarkerDispatches,
        quarantined: true,
      };

      const materializeDraft = await createDraftAndPayload({
        answer: "Live outbox accepted materialization recovery verification answer.",
        row: samples[4],
        serviceClient,
        userId,
      });
      draftIds.push(materializeDraft.draftId);
      const materializeIntent = randomUUID();
      intentIds.push(materializeIntent);
      let materializeDispatches = 0;
      let failMaterialize = true;
      const materializeFault = withRpcFault(serviceClient, (name) => {
        if (name !== "materialize_writing_submission_intent" || !failMaterialize) {
          return null;
        }
        failMaterialize = false;
        return Promise.resolve({
          data: null,
          error: { message: "simulated materialization response loss" },
        });
      });
      await expect(
        dispatchWritingSubmissionIntent({
          classifyProviderFailure,
          client: materializeFault,
          dispatchProvider: async () => {
            materializeDispatches += 1;
            return {
              externalSubmissionId: `dev-fault-${randomUUID()}`,
              providerStatus: "processing",
            };
          },
          intentId: materializeIntent,
          submission: materializeDraft.payload,
        }),
      ).rejects.toThrow("simulated materialization response loss");
      await expect(
        dispatchWritingSubmissionIntent({
          classifyProviderFailure,
          client: realClient,
          dispatchProvider: async () => {
            materializeDispatches += 1;
            throw new Error("must not redispatch");
          },
          intentId: materializeIntent,
          submission: materializeDraft.payload,
        }),
      ).resolves.toBe(materializeIntent);
      expect(materializeDispatches).toBe(1);
      scenarios.materializationRecovery = {
        providerDispatches: materializeDispatches,
        recovered: true,
      };

      const liveCounts = await managementSql(
        config,
        `select jsonb_build_object(
          'intents', (select count(*) from private.writing_submission_intents where intent_id = any(${uuidArray(intentIds)})),
          'audit_rows', (select count(*) from private.writing_submission_intent_audit where intent_id = any(${uuidArray(intentIds)})),
          'submissions', (select count(*) from public.writing_submissions where id = any(${uuidArray(intentIds)})),
          'answer_columns_in_audit', exists(
            select 1 from information_schema.columns
             where table_schema = 'private'
               and table_name = 'writing_submission_intent_audit'
               and column_name in ('answer_text', 'answer_json')
          )
        ) as evidence;`,
      );
      const liveEvidence = liveCounts[0]?.evidence as
        | Record<string, unknown>
        | undefined;
      expect(Number(liveEvidence?.intents)).toBe(6);
      expect(Number(liveEvidence?.submissions)).toBe(3);
      expect(Number(liveEvidence?.audit_rows)).toBe(21);
      expect(liveEvidence?.answer_columns_in_audit).toBe(false);

      await cleanupRun(config, draftIds, intentIds);
      cleanupComplete = true;
      await setSubmissionState(
        serviceClient,
        "blocked",
        "close service-only live outbox fault verification",
      );
      verificationOpened = false;

      const cleanupCounts = await managementSql(
        config,
        `select jsonb_build_object(
          'intents', (select count(*) from private.writing_submission_intents where intent_id = any(${uuidArray(intentIds)})),
          'audit_rows', (select count(*) from private.writing_submission_intent_audit where intent_id = any(${uuidArray(intentIds)})),
          'drafts', (select count(*) from public.writing_drafts where id = any(${uuidArray(draftIds)})),
          'submissions', (select count(*) from public.writing_submissions where id = any(${uuidArray(intentIds)}))
        ) as evidence;`,
      );
      const cleanupEvidence = cleanupCounts[0]?.evidence as
        | Record<string, unknown>
        | undefined;
      expect(cleanupEvidence).toEqual({
        audit_rows: 0,
        drafts: 0,
        intents: 0,
        submissions: 0,
      });

      const report = {
        cleanup: "complete",
        contract: "writing-outbox-v2",
        contractDigest: OUTBOX_CONTRACT_DIGEST,
        projectRefHash: createHash("sha256")
          .update(config.expectedProjectRef)
          .digest("hex"),
        scenarios,
        schemaVersion: 2,
        verifiedAt: new Date().toISOString(),
      };
      mkdirSync(dirname(config.reportPath), { recursive: true });
      writeFileSync(config.reportPath, `${JSON.stringify(report, null, 2)}\n`, {
        encoding: "utf8",
        flag: "wx",
      });
    } finally {
      if (!cleanupComplete && (draftIds.length > 0 || intentIds.length > 0)) {
        await cleanupRun(config, draftIds, intentIds);
      }
      if (verificationOpened) {
        await setSubmissionState(
          serviceClient,
          "blocked",
          "fail-closed after live outbox fault verification",
        );
      }
      await studentClient.auth.signOut({ scope: "local" });
    }
  }, 120_000);
});
