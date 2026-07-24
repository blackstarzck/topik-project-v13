import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { assertLocalPrivilegedMutationTarget } from "../../scripts/lib/supabase-target-safety.mjs";

function loadEnvLocal() {
  try {
    const raw = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // Integration tests skip when env is absent.
  }
}

loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
const EMAIL = process.env.E2E_STUDENT_EMAIL;
const PASSWORD =
  process.env.E2E_STUDENT_PASSWORD ?? process.env.SUPABASE_TEST_PASSWORD;

const canRun = Boolean(
  process.env.SUPABASE_LOCAL_STACK === "1" &&
  SUPABASE_URL &&
  PUBLISHABLE_KEY &&
  SERVICE_KEY &&
  EMAIL &&
  PASSWORD,
);

if (canRun) {
  assertLocalPrivilegedMutationTarget(process.env);
}

type ClaimResponse = {
  allowed: boolean;
  code?: string;
  usageIds?: string[];
  limit?: number;
  used?: number;
  remaining?: number;
};

type AcquisitionResponse = {
  attemptId: string | null;
  exportId: string;
  leaseExpiresAt: string | null;
  renderSource: "server_render" | "browser_print";
  state: "queued" | "ready";
  storagePath: string;
};

let service: SupabaseClient | null = null;
let userClient: SupabaseClient | null = null;
let anonClient: SupabaseClient | null = null;
let inactiveClient: SupabaseClient | null = null;
let userId = "";
let inactiveUserId = "";
let problemId = "";
let ownedSubmissionId = "";
let ownLibraryItemId = "";
let unexportableLibraryItemId = "";
const resetIds: string[] = [];
const exportFileIds = new Set<string>();
const exportRequestIds = new Set<string>();
const libraryItemIds = new Set<string>();

function acquisitionOptions(itemIds: string[], filename = "learning-export") {
  return {
    filename,
    includeAnswers: true,
    includeFeedback: true,
    layout: "paged",
    orientation: "portrait",
    request_item_ids: itemIds,
  };
}

async function acquireRaw(
  client: SupabaseClient,
  requestId: string,
  itemIds = [ownLibraryItemId],
  filename = "learning-export",
) {
  return client.rpc("acquire_pdf_export_attempt", {
    p_request_id: requestId,
    p_source_type: "library_selection",
    p_source_id: null,
    p_request_options: acquisitionOptions(itemIds, filename),
    p_render_source: "server_render",
  });
}

async function acquireOwn(requestId: string) {
  const { data, error } = await acquireRaw(userClient!, requestId);
  if (error) throw error;
  const acquired = data as AcquisitionResponse;
  exportFileIds.add(acquired.exportId);
  exportRequestIds.add(requestId);
  return acquired;
}

async function seedReset() {
  const reset = await service!
    .from("pdf_export_quota_resets")
    .insert({
      reset_scope: "user",
      problem_id: problemId,
      reason: "integration pdf quota reset",
      created_by: userId,
    })
    .select("id")
    .single();
  if (reset.error) throw reset.error;
  resetIds.push(reset.data.id);

  const target = await service!.from("pdf_export_quota_reset_targets").insert({
    reset_id: reset.data.id,
    user_id: userId,
  });
  if (target.error) throw target.error;
}

async function claimOnly(requestId: string) {
  const { data, error } = await userClient!.rpc("claim_pdf_export_quota", {
    p_user_id: userId,
    p_problem_ids: [problemId],
    p_request_id: requestId,
  });
  if (error) throw error;
  return data as ClaimResponse;
}

async function acquireAndClaim(requestId = randomUUID()) {
  await acquireOwn(requestId);
  return claimOnly(requestId);
}

async function createReadyExportFile(requestId: string) {
  const exportFileId = randomUUID();
  const inserted = await service!.from("export_files").insert({
    id: exportFileId,
    request_id: requestId,
    user_id: userId,
    source_type: "submission",
    source_id: null,
    storage_path: `rpc-test://${exportFileId}`,
    options: { source: "rpc_test" },
    status: "ready",
    ready_at: new Date().toISOString(),
  });
  if (inserted.error) throw inserted.error;
  exportFileIds.add(exportFileId);
  exportRequestIds.add(requestId);
  return exportFileId;
}

describe.skipIf(!canRun)("PDF export quota RPC integration", () => {
  beforeAll(async () => {
    service = createClient(SUPABASE_URL!, SERVICE_KEY!, {
      auth: { persistSession: false },
    });
    userClient = createClient(SUPABASE_URL!, PUBLISHABLE_KEY!, {
      auth: { persistSession: false },
    });
    anonClient = createClient(SUPABASE_URL!, PUBLISHABLE_KEY!, {
      auth: { persistSession: false },
    });

    const signedIn = await userClient.auth.signInWithPassword({
      email: EMAIL!,
      password: PASSWORD!,
    });
    if (signedIn.error) throw signedIn.error;
    userId = signedIn.data.user.id;

    const problem = await userClient.rpc("get_available_writing_questions", {
      p_item_number: 51,
      p_problem_id: null,
    });
    if (problem.error) throw problem.error;
    const canonicalProblemId = problem.data?.[0]?.problem_id;
    if (!canonicalProblemId) {
      throw new Error("No published canonical q51 problem found");
    }
    problemId = canonicalProblemId;

    const inactiveEmail = `pdf-export-inactive-${randomUUID()}@example.test`;
    const inactivePassword = `Pdf-${randomUUID()}!Aa1`;
    const createdInactiveUser = await service.auth.admin.createUser({
      email: inactiveEmail,
      email_confirm: true,
      password: inactivePassword,
      user_metadata: {},
    });
    if (createdInactiveUser.error) throw createdInactiveUser.error;
    inactiveUserId = createdInactiveUser.data.user.id;

    inactiveClient = createClient(SUPABASE_URL!, PUBLISHABLE_KEY!, {
      auth: { persistSession: false },
    });
    const inactiveSignedIn = await inactiveClient.auth.signInWithPassword({
      email: inactiveEmail,
      password: inactivePassword,
    });
    if (inactiveSignedIn.error) throw inactiveSignedIn.error;

    const ownedSubmission = await userClient
      .from("writing_submissions")
      .select("id, problem_id")
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ownedSubmission.error) throw ownedSubmission.error;
    if (!ownedSubmission.data?.id) {
      throw new Error(
        "The local PDF integration account needs one owned writing submission",
      );
    }
    ownedSubmissionId = ownedSubmission.data.id;
    problemId = ownedSubmission.data.problem_id;

    ownLibraryItemId = randomUUID();
    unexportableLibraryItemId = randomUUID();
    const libraryItems = await service.from("library_items").insert([
      {
        id: ownLibraryItemId,
        user_id: userId,
        item_type: "submission",
        submission_id: ownedSubmissionId,
      },
      {
        id: unexportableLibraryItemId,
        user_id: userId,
        item_type: "problem",
        problem_id: problemId,
      },
    ]);
    if (libraryItems.error) throw libraryItems.error;
    libraryItemIds.add(ownLibraryItemId);
    libraryItemIds.add(unexportableLibraryItemId);
  });

  afterAll(async () => {
    if (!service) return;
    if (userId && problemId) {
      await service
        .from("pdf_export_quota_usages")
        .delete()
        .eq("user_id", userId)
        .eq("problem_id", problemId);
    }
    if (userId && exportRequestIds.size > 0) {
      await service
        .from("pdf_export_request_periods")
        .delete()
        .eq("user_id", userId)
        .in("request_id", [...exportRequestIds]);
    }
    for (const exportFileId of exportFileIds) {
      await service.from("export_files").delete().eq("id", exportFileId);
    }
    if (libraryItemIds.size > 0) {
      await service
        .from("library_items")
        .delete()
        .in("id", [...libraryItemIds]);
    }
    for (const resetId of resetIds) {
      await service
        .from("pdf_export_quota_reset_targets")
        .delete()
        .eq("reset_id", resetId);
      await service.from("pdf_export_quota_resets").delete().eq("id", resetId);
    }
    if (inactiveUserId) {
      await service.auth.admin.deleteUser(inactiveUserId);
    }
  });

  it("acquires with the owner JWT and rejects active-lease or payload-conflicting retries", async () => {
    const requestId = randomUUID();
    const first = await acquireOwn(requestId);

    expect(first).toMatchObject({
      state: "queued",
      renderSource: "server_render",
    });
    expect(first.attemptId).toEqual(expect.any(String));
    expect(first.leaseExpiresAt).toEqual(expect.any(String));

    const activeLease = await acquireRaw(userClient!, requestId);
    expect(activeLease.error?.code).toBe("55P03");

    const payloadMismatch = await acquireRaw(
      userClient!,
      requestId,
      [ownLibraryItemId],
      "different-export",
    );
    expect(payloadMismatch.error?.code).toBe("22023");
  });

  it("rejects foreign ownership and blocks acquire or claim after the profile becomes inactive", async () => {
    const foreignRequestId = randomUUID();
    const foreign = await acquireRaw(inactiveClient!, foreignRequestId, [
      ownLibraryItemId,
    ]);
    expect(foreign.error?.code).toBe("42501");

    const inactiveRequestId = randomUUID();
    const deleted = await inactiveClient!.rpc("request_account_deletion");
    if (deleted.error) throw deleted.error;

    const blockedAcquire = await acquireRaw(inactiveClient!, randomUUID(), [
      ownLibraryItemId,
    ]);
    expect(blockedAcquire.error?.code).toBe("42501");

    const blockedClaim = await inactiveClient!.rpc("claim_pdf_export_quota", {
      p_user_id: inactiveUserId,
      p_problem_ids: [problemId],
      p_request_id: inactiveRequestId,
    });
    expect(blockedClaim.error?.code).toBe("42501");

    const requestBinding = await service!
      .from("pdf_export_request_periods")
      .select("request_id")
      .eq("user_id", inactiveUserId)
      .eq("request_id", inactiveRequestId);
    if (requestBinding.error) throw requestBinding.error;
    expect(requestBinding.data).toHaveLength(0);

    const usage = await service!
      .from("pdf_export_quota_usages")
      .select("id")
      .eq("user_id", inactiveUserId)
      .eq("request_id", inactiveRequestId);
    if (usage.error) throw usage.error;
    expect(usage.data).toHaveLength(0);
  });

  it("rejects library item types that the PDF route cannot resolve", async () => {
    const result = await acquireRaw(userClient!, randomUUID(), [
      unexportableLibraryItemId,
    ]);
    expect(result.error?.code).toBe("42501");
  });

  it("reuses the export id but rotates the attempt after stale leases or failures", async () => {
    const requestId = randomUUID();
    const first = await acquireOwn(requestId);

    const expired = await service!
      .from("export_files")
      .update({
        lease_expires_at: new Date(Date.now() - 1_000).toISOString(),
      })
      .eq("id", first.exportId);
    if (expired.error) throw expired.error;

    const staleRetry = await acquireOwn(requestId);
    expect(staleRetry.exportId).toBe(first.exportId);
    expect(staleRetry.attemptId).not.toBe(first.attemptId);

    const failed = await service!
      .from("export_files")
      .update({
        status: "failed",
        failure_code: "server_render_failed",
        failed_at: new Date().toISOString(),
        lease_expires_at: null,
      })
      .eq("id", first.exportId);
    if (failed.error) throw failed.error;

    const failedRetry = await acquireOwn(requestId);
    expect(failedRetry.exportId).toBe(first.exportId);
    expect(failedRetry.attemptId).not.toBe(staleRetry.attemptId);
  });

  it("rejects direct authenticated export ledger writes", async () => {
    const requestId = randomUUID();
    const acquired = await acquireOwn(requestId);

    const inserted = await userClient!.from("export_files").insert({
      user_id: userId,
      request_id: randomUUID(),
      source_type: "library_selection",
      source_id: null,
      storage_path: "forbidden://insert",
      status: "queued",
    });
    expect(inserted.error?.code).toBe("42501");

    const updated = await userClient!
      .from("export_files")
      .update({ status: "ready" })
      .eq("id", acquired.exportId);
    expect(updated.error?.code).toBe("42501");

    const deleted = await userClient!
      .from("export_files")
      .delete()
      .eq("id", acquired.exportId);
    expect(deleted.error?.code).toBe("42501");
  });

  it("keeps acquisition on authenticated JWT and terminal mutations on service role", async () => {
    const anonAcquire = await acquireRaw(anonClient!, randomUUID(), [
      ownLibraryItemId,
    ]);
    expect(anonAcquire.error?.code).toBe("42501");

    const serviceAcquire = await acquireRaw(service!, randomUUID(), [
      ownLibraryItemId,
    ]);
    expect(serviceAcquire.error?.code).toBe("42501");

    const usageId = randomUUID();
    const exportId = randomUUID();
    const attemptId = randomUUID();
    const authenticatedTerminalCalls = await Promise.all([
      userClient!.rpc("commit_pdf_export_quota", {
        p_user_id: userId,
        p_usage_ids: [usageId],
        p_export_file_id: exportId,
      }),
      userClient!.rpc("release_pdf_export_quota", {
        p_user_id: userId,
        p_usage_ids: [usageId],
        p_reason: "forbidden",
      }),
      userClient!.rpc("complete_pdf_export_attempt", {
        p_user_id: userId,
        p_usage_ids: [usageId],
        p_export_file_id: exportId,
        p_attempt_id: attemptId,
        p_storage_path: "forbidden://complete",
      }),
      userClient!.rpc("fail_pdf_export_attempt", {
        p_user_id: userId,
        p_usage_ids: [usageId],
        p_export_file_id: exportId,
        p_attempt_id: attemptId,
        p_failure_code: "unknown",
        p_reason: "forbidden",
      }),
    ]);
    for (const result of authenticatedTerminalCalls) {
      expect(result.error?.code).toBe("42501");
    }
  });

  it("rejects direct claim without a matching acquired export and leaves no quota rows", async () => {
    const noExportRequestId = randomUUID();
    const noExport = await userClient!.rpc("claim_pdf_export_quota", {
      p_user_id: userId,
      p_problem_ids: [problemId],
      p_request_id: noExportRequestId,
    });
    expect(noExport.error?.code).toBe("P0002");

    const acquiredRequestId = randomUUID();
    await acquireOwn(acquiredRequestId);
    const mismatchedRequestId = randomUUID();
    const mismatch = await userClient!.rpc("claim_pdf_export_quota", {
      p_user_id: userId,
      p_problem_ids: [problemId],
      p_request_id: mismatchedRequestId,
    });
    expect(mismatch.error?.code).toBe("P0002");

    for (const requestId of [noExportRequestId, mismatchedRequestId]) {
      const requestBinding = await service!
        .from("pdf_export_request_periods")
        .select("request_id")
        .eq("user_id", userId)
        .eq("request_id", requestId);
      if (requestBinding.error) throw requestBinding.error;
      expect(requestBinding.data).toHaveLength(0);

      const usage = await service!
        .from("pdf_export_quota_usages")
        .select("id")
        .eq("user_id", userId)
        .eq("request_id", requestId);
      if (usage.error) throw usage.error;
      expect(usage.data).toHaveLength(0);
    }
  });

  it("binds quota claims to the exact acquired problem set and fails closed if an acquired item disappears", async () => {
    const mismatchedRequestId = randomUUID();
    await acquireOwn(mismatchedRequestId);

    const arbitraryProblem = await userClient!.rpc("claim_pdf_export_quota", {
      p_user_id: userId,
      p_problem_ids: [randomUUID()],
      p_request_id: mismatchedRequestId,
    });
    expect(arbitraryProblem.error?.code).toBe("22023");

    const oversizedRequestId = randomUUID();
    await acquireOwn(oversizedRequestId);
    const oversized = await userClient!.rpc("claim_pdf_export_quota", {
      p_user_id: userId,
      p_problem_ids: Array.from({ length: 7 }, () => randomUUID()).sort(),
      p_request_id: oversizedRequestId,
    });
    expect(oversized.error?.code).toBe("22023");

    const removableItemId = randomUUID();
    const removableItem = await service!.from("library_items").insert({
      id: removableItemId,
      user_id: userId,
      item_type: "submission",
      submission_id: ownedSubmissionId,
    });
    if (removableItem.error) throw removableItem.error;
    libraryItemIds.add(removableItemId);

    const missingItemRequestId = randomUUID();
    const acquired = await acquireRaw(userClient!, missingItemRequestId, [
      removableItemId,
    ]);
    if (acquired.error) throw acquired.error;
    exportFileIds.add((acquired.data as AcquisitionResponse).exportId);
    exportRequestIds.add(missingItemRequestId);

    const removed = await service!
      .from("library_items")
      .delete()
      .eq("id", removableItemId);
    if (removed.error) throw removed.error;
    libraryItemIds.delete(removableItemId);

    const missingItem = await userClient!.rpc("claim_pdf_export_quota", {
      p_user_id: userId,
      p_problem_ids: [problemId],
      p_request_id: missingItemRequestId,
    });
    expect(missingItem.error?.code).toBe("P0002");

    for (const requestId of [
      mismatchedRequestId,
      oversizedRequestId,
      missingItemRequestId,
    ]) {
      const binding = await service!
        .from("pdf_export_request_periods")
        .select("request_id")
        .eq("user_id", userId)
        .eq("request_id", requestId);
      if (binding.error) throw binding.error;
      expect(binding.data).toHaveLength(0);
    }

    const exactRequestId = randomUUID();
    await acquireOwn(exactRequestId);
    await expect(claimOnly(exactRequestId)).resolves.toMatchObject({
      allowed: true,
    });
  });

  it("rejects malformed or oversized direct acquisition options", async () => {
    const valid = acquisitionOptions([ownLibraryItemId]);
    const invalidOptions = [
      { ...valid, unexpected: true },
      { ...valid, includeAnswers: "true" },
      { ...valid, filename: "x".repeat(61) },
      { ...valid, filename: "x".repeat(5_000) },
      {
        ...valid,
        request_item_ids: Array.from({ length: 7 }, () => randomUUID()),
      },
      { ...valid, request_item_ids: ["not-a-uuid"] },
      {
        ...valid,
        request_item_ids: [ownLibraryItemId, ownLibraryItemId],
      },
    ];

    for (const options of invalidOptions) {
      const result = await userClient!.rpc("acquire_pdf_export_attempt", {
        p_request_id: randomUUID(),
        p_source_type: "library_selection",
        p_source_id: null,
        p_request_options: options,
        p_render_source: "server_render",
      });
      expect(result.error?.code).toBe("22023");
    }
  });

  it("rejects null acquisition discriminators instead of relying on SQL null semantics", async () => {
    const validOptions = acquisitionOptions([ownLibraryItemId]);
    const invalidRequests = [
      {
        p_source_type: null,
        p_request_options: validOptions,
        p_render_source: "server_render",
      },
      {
        p_source_type: "library_selection",
        p_request_options: null,
        p_render_source: "server_render",
      },
      {
        p_source_type: "library_selection",
        p_request_options: validOptions,
        p_render_source: null,
      },
    ];

    for (const invalid of invalidRequests) {
      const result = await userClient!.rpc("acquire_pdf_export_attempt", {
        p_request_id: randomUUID(),
        p_source_id: null,
        ...invalid,
      });
      expect(result.error?.code).toBe("22023");
    }
  });

  it("allows three claims for the same user/problem and blocks the fourth", async () => {
    await seedReset();

    await expect(acquireAndClaim()).resolves.toMatchObject({
      allowed: true,
      used: 1,
    });
    await expect(acquireAndClaim()).resolves.toMatchObject({
      allowed: true,
      used: 2,
    });
    await expect(acquireAndClaim()).resolves.toMatchObject({
      allowed: true,
      used: 3,
      remaining: 0,
    });
    await expect(acquireAndClaim()).resolves.toMatchObject({
      allowed: false,
      code: "pdf_export_quota_exceeded",
      limit: 3,
      used: 3,
      remaining: 0,
    });
  });

  it("does not count released reservations", async () => {
    await seedReset();
    const first = await acquireAndClaim();
    expect(first.allowed).toBe(true);
    expect(first.usageIds).toHaveLength(1);

    const userReleaseAttempt = await userClient!.rpc(
      "release_pdf_export_quota",
      {
        p_user_id: userId,
        p_usage_ids: first.usageIds,
        p_reason: "forbidden_user_release",
      },
    );
    expect(userReleaseAttempt.error).toBeTruthy();

    const released = await service!.rpc("release_pdf_export_quota", {
      p_user_id: userId,
      p_usage_ids: first.usageIds,
      p_reason: "integration_release",
    });
    if (released.error) throw released.error;

    await expect(acquireAndClaim()).resolves.toMatchObject({
      allowed: true,
      used: 1,
    });
    await expect(acquireAndClaim()).resolves.toMatchObject({
      allowed: true,
      used: 2,
    });
    await expect(acquireAndClaim()).resolves.toMatchObject({
      allowed: true,
      used: 3,
      remaining: 0,
    });
    await expect(acquireAndClaim()).resolves.toMatchObject({ allowed: false });
  });

  it("allows the same period again after a materialized user reset", async () => {
    await seedReset();
    await acquireAndClaim();
    await acquireAndClaim();
    await acquireAndClaim();
    await expect(acquireAndClaim()).resolves.toMatchObject({ allowed: false });

    await seedReset();
    await expect(acquireAndClaim()).resolves.toMatchObject({
      allowed: true,
      used: 1,
    });
  });

  it("serializes concurrent claims so only three are allowed", async () => {
    await seedReset();

    const results = await Promise.all(
      Array.from({ length: 4 }, () => acquireAndClaim()),
    );

    expect(results.filter((result) => result.allowed)).toHaveLength(3);
    expect(results.filter((result) => !result.allowed)).toHaveLength(1);
  });

  it("reuses one reservation when the same request is retried", async () => {
    await seedReset();
    const requestId = randomUUID();

    const first = await acquireAndClaim(requestId);
    const retried = await claimOnly(requestId);

    expect(first).toMatchObject({ allowed: true, used: 1 });
    expect(retried).toMatchObject({
      allowed: true,
      used: 1,
      usageIds: first.usageIds,
    });
  });

  it("commits reserved quota to an export file id", async () => {
    await seedReset();
    const requestId = randomUUID();
    const exportFileId = await createReadyExportFile(requestId);
    const first = await claimOnly(requestId);
    expect(first.allowed).toBe(true);

    const committed = await service!.rpc("commit_pdf_export_quota", {
      p_user_id: userId,
      p_usage_ids: first.usageIds,
      p_export_file_id: exportFileId,
    });
    if (committed.error) throw committed.error;

    const usage = await service!
      .from("pdf_export_quota_usages")
      .select("status, export_file_id")
      .eq("id", first.usageIds![0])
      .single();
    if (usage.error) throw usage.error;
    expect(usage.data).toMatchObject({
      status: "committed",
      export_file_id: exportFileId,
    });
  });

  it("atomically completes the current export attempt and commits its reservation", async () => {
    await seedReset();
    const requestId = randomUUID();
    const { attemptId, exportId: exportFileId } = await acquireOwn(requestId);
    const first = await claimOnly(requestId);
    expect(first.allowed).toBe(true);
    if (!attemptId) throw new Error("queued acquisition missing attempt id");
    const storagePath = `exports/${userId}/${exportFileId}/${attemptId}.pdf`;

    const completed = await service!.rpc("complete_pdf_export_attempt", {
      p_user_id: userId,
      p_usage_ids: first.usageIds,
      p_export_file_id: exportFileId,
      p_attempt_id: attemptId,
      p_storage_path: storagePath,
    });
    if (completed.error) throw completed.error;
    expect(completed.data).toBe(true);

    const exportFile = await service!
      .from("export_files")
      .select("status, storage_path, lease_expires_at")
      .eq("id", exportFileId)
      .single();
    if (exportFile.error) throw exportFile.error;
    expect(exportFile.data).toMatchObject({
      status: "ready",
      storage_path: storagePath,
      lease_expires_at: null,
    });

    const usage = await service!
      .from("pdf_export_quota_usages")
      .select("status, export_file_id")
      .eq("id", first.usageIds![0])
      .single();
    if (usage.error) throw usage.error;
    expect(usage.data).toMatchObject({
      status: "committed",
      export_file_id: exportFileId,
    });
  });

  it("atomically fails the current export attempt and releases its reservation", async () => {
    await seedReset();
    const requestId = randomUUID();
    const { attemptId, exportId: exportFileId } = await acquireOwn(requestId);
    const first = await claimOnly(requestId);
    expect(first.allowed).toBe(true);
    if (!attemptId) throw new Error("queued acquisition missing attempt id");

    const failed = await service!.rpc("fail_pdf_export_attempt", {
      p_user_id: userId,
      p_usage_ids: first.usageIds,
      p_export_file_id: exportFileId,
      p_attempt_id: attemptId,
      p_failure_code: "server_render_failed",
      p_reason: "integration_failure",
    });
    if (failed.error) throw failed.error;
    expect(failed.data).toBe("failed_current");

    const exportFile = await service!
      .from("export_files")
      .select("status, failure_code, lease_expires_at")
      .eq("id", exportFileId)
      .single();
    if (exportFile.error) throw exportFile.error;
    expect(exportFile.data).toMatchObject({
      status: "failed",
      failure_code: "server_render_failed",
      lease_expires_at: null,
    });

    const usage = await service!
      .from("pdf_export_quota_usages")
      .select("status, export_file_id")
      .eq("id", first.usageIds![0])
      .single();
    if (usage.error) throw usage.error;
    expect(usage.data).toMatchObject({
      status: "released",
      export_file_id: null,
    });
  });
});
