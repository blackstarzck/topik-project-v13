import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
const PASSWORD = process.env.SUPABASE_TEST_PASSWORD;
const canRun = Boolean(
  SUPABASE_URL && PUBLISHABLE_KEY && SERVICE_KEY && EMAIL && PASSWORD,
);

type ClaimResponse = {
  allowed: boolean;
  code?: string;
  usageIds?: string[];
  limit?: number;
  used?: number;
  remaining?: number;
};

let service: SupabaseClient | null = null;
let userClient: SupabaseClient | null = null;
let userId = "";
let problemId = "";
const resetIds: string[] = [];
const exportFileIds: string[] = [];

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

async function claim() {
  const { data, error } = await userClient!.rpc("claim_pdf_export_quota", {
    p_user_id: userId,
    p_problem_ids: [problemId],
  });
  if (error) throw error;
  return data as ClaimResponse;
}

async function createExportFile() {
  const exportFileId = randomUUID();
  const inserted = await service!.from("export_files").insert({
    id: exportFileId,
    user_id: userId,
    source_type: "submission",
    source_id: null,
    storage_path: `rpc-test://${exportFileId}`,
    options: { source: "rpc_test" },
    status: "ready",
    ready_at: new Date().toISOString(),
  });
  if (inserted.error) throw inserted.error;
  exportFileIds.push(exportFileId);
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

    const signedIn = await userClient.auth.signInWithPassword({
      email: EMAIL!,
      password: PASSWORD!,
    });
    if (signedIn.error) throw signedIn.error;
    userId = signedIn.data.user.id;

    const problem = await service
      .from("problems")
      .select("id")
      .eq("domain", "writing")
      .eq("question_no", 51)
      .eq("publish_status", "published")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (problem.error) throw problem.error;
    if (!problem.data?.id) throw new Error("No published q51 problem found");
    problemId = problem.data.id;
  });

  afterAll(async () => {
    if (!service || !userId || !problemId) return;
    await service
      .from("pdf_export_quota_usages")
      .delete()
      .eq("user_id", userId)
      .eq("problem_id", problemId);
    for (const exportFileId of exportFileIds) {
      await service.from("export_files").delete().eq("id", exportFileId);
    }
    for (const resetId of resetIds) {
      await service
        .from("pdf_export_quota_reset_targets")
        .delete()
        .eq("reset_id", resetId);
      await service.from("pdf_export_quota_resets").delete().eq("id", resetId);
    }
  });

  it("allows three claims for the same user/problem and blocks the fourth", async () => {
    await seedReset();

    await expect(claim()).resolves.toMatchObject({ allowed: true, used: 1 });
    await expect(claim()).resolves.toMatchObject({ allowed: true, used: 2 });
    await expect(claim()).resolves.toMatchObject({
      allowed: true,
      used: 3,
      remaining: 0,
    });
    await expect(claim()).resolves.toMatchObject({
      allowed: false,
      code: "pdf_export_quota_exceeded",
      limit: 3,
      used: 3,
      remaining: 0,
    });
  });

  it("does not count released reservations", async () => {
    await seedReset();
    const first = await claim();
    expect(first.allowed).toBe(true);
    expect(first.usageIds).toHaveLength(1);

    const userReleaseAttempt = await userClient!.rpc("release_pdf_export_quota", {
      p_user_id: userId,
      p_usage_ids: first.usageIds,
      p_reason: "forbidden_user_release",
    });
    expect(userReleaseAttempt.error).toBeTruthy();

    const released = await service!.rpc("release_pdf_export_quota", {
      p_user_id: userId,
      p_usage_ids: first.usageIds,
      p_reason: "integration_release",
    });
    if (released.error) throw released.error;

    await expect(claim()).resolves.toMatchObject({ allowed: true, used: 1 });
    await expect(claim()).resolves.toMatchObject({ allowed: true, used: 2 });
    await expect(claim()).resolves.toMatchObject({
      allowed: true,
      used: 3,
      remaining: 0,
    });
    await expect(claim()).resolves.toMatchObject({ allowed: false });
  });

  it("allows the same period again after a materialized user reset", async () => {
    await seedReset();
    await claim();
    await claim();
    await claim();
    await expect(claim()).resolves.toMatchObject({ allowed: false });

    await seedReset();
    await expect(claim()).resolves.toMatchObject({ allowed: true, used: 1 });
  });

  it("serializes concurrent claims so only three are allowed", async () => {
    await seedReset();

    const results = await Promise.all(
      Array.from({ length: 4 }, () => claim()),
    );

    expect(results.filter((result) => result.allowed)).toHaveLength(3);
    expect(results.filter((result) => !result.allowed)).toHaveLength(1);
  });

  it("commits reserved quota to an export file id", async () => {
    await seedReset();
    const first = await claim();
    expect(first.allowed).toBe(true);
    const exportFileId = await createExportFile();

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
});
