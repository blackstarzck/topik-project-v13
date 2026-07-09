import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// C-01 — LIVE rule-based fallback (no route interception).
//
// Forces the Tier-2 computed path against the real DB: the e2e student's
// active recommendation_runs are temporarily expired (Tier-1 → 0 rows) and two
// fresh public marker problems guarantee at least one eligible candidate. The
// page must then render REAL computed recommendations end-to-end.
//
// Durable-fixture safety: scripts/seed-e2e-audit-fixtures.mjs seeds 4 active
// recommendation items that weakness-recommendations.spec.ts and
// screens-authed.spec.ts depend on. We therefore NEVER delete those rows —
// only recommendation_runs.expires_at is flipped to the past and restored to
// its original value in afterAll.
//
// RECOVERY if this spec crashes between beforeAll and afterAll (runs left
// expired, dependent suites losing their fixtures):
//   node scripts/seed-e2e-audit-fixtures.mjs

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
    // CI without .env.local will fail through the explicit env guard below.
  }
}

loadEnvLocal();

const EMAIL = process.env.E2E_STUDENT_EMAIL ?? "student@audit.local";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
const EXPIRED_AT = "2020-01-01T00:00:00.000Z";

const STRINGS = {
  heading: "추천 문제",
  reasonSummaryTitle: "이렇게 추천했어요",
  primaryBadge: "대표 추천",
  emptyDescription:
    "아직 추천할 문제가 없어요. 아래에서 유형을 직접 골라 시작해 보세요.",
} as const;

function serviceClient() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error(
      "Missing Supabase service credentials for C-01 fallback live setup",
    );
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

const createdProblemIds: string[] = [];
let flippedRuns: Array<{ id: string; expires_at: string | null }> = [];

test.beforeAll(async () => {
  const sb = serviceClient();
  const users = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) throw users.error;
  const student = users.data.users.find(
    (candidate) => candidate.email?.toLowerCase() === EMAIL.toLowerCase(),
  );
  if (!student) throw new Error(`E2E student user not found: ${EMAIL}`);

  // Two fresh PUBLIC problems (no institution exposure mapping, real
  // materials.question_id so the visibility predicate can resolve them, and
  // deliberately NO "seed:" tag so the fallback does not exclude them).
  // Future timestamps keep them on the first updated_at page.
  const marker = `e2e-c01-fallback-${randomUUID().slice(0, 8)}`;
  const stampedAt = new Date(Date.now() + 90_000).toISOString();
  const problemRows = [51, 52].map((questionNo, index) => ({
    id: randomUUID(),
    source: "curated" as const,
    domain: "writing" as const,
    question_no: questionNo,
    topik_level: 2,
    difficulty: 3 + index,
    title: `E2E C01 fallback ${marker} ${questionNo}`,
    prompt: "다음 안내문을 읽고 알맞은 내용을 쓰십시오.",
    materials: { question_id: `${marker}-${questionNo}` },
    answer_key: null,
    rubric: {},
    tags: [marker, "e2e-c01-fallback"],
    publish_status: "published" as const,
    review_status: "approved" as const,
    visibility: "public" as const,
    lifecycle_status: "active" as const,
    created_at: stampedAt,
    updated_at: stampedAt,
  }));
  const inserted = await sb.from("problems").insert(problemRows).select("id");
  if (inserted.error) throw inserted.error;
  createdProblemIds.push(...problemRows.map((row) => row.id));

  // Expire (don't delete!) every currently-active run so Tier-1 yields zero.
  const nowIso = new Date().toISOString();
  const runs = await sb
    .from("recommendation_runs")
    .select("id, expires_at")
    .eq("user_id", student.id);
  if (runs.error) throw runs.error;
  const activeRuns = (runs.data ?? []).filter(
    (run) => run.expires_at == null || run.expires_at > nowIso,
  );
  flippedRuns = activeRuns.map((run) => ({
    id: run.id,
    expires_at: run.expires_at,
  }));
  for (const run of flippedRuns) {
    const flipped = await sb
      .from("recommendation_runs")
      .update({ expires_at: EXPIRED_AT })
      .eq("id", run.id);
    if (flipped.error) throw flipped.error;
  }
});

test.afterAll(async () => {
  const sb = serviceClient();
  // Restore each run's original expires_at (usually null on durable seeds).
  for (const run of flippedRuns) {
    await sb
      .from("recommendation_runs")
      .update({ expires_at: run.expires_at })
      .eq("id", run.id);
  }
  flippedRuns = [];
  if (createdProblemIds.length > 0) {
    await sb.from("problems").delete().in("id", createdProblemIds);
    createdProblemIds.length = 0;
  }
});

function collectServerErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("response", (response) => {
    if (response.status() >= 500) {
      errors.push(`response: ${response.status()} ${response.url()}`);
    }
  });
  return errors;
}

test("C-01 live: with zero stored items the rule-based fallback recommends real problems", async ({
  page,
}) => {
  await page.route("**/rest/v1/user_notifications?**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  const serverErrors = collectServerErrors(page);

  await page.goto("/practice/recommendations", { waitUntil: "networkidle" });

  await expect(page).not.toHaveURL(/\/login/);
  await expect(
    page.getByRole("heading", { name: STRINGS.heading }),
  ).toBeVisible();

  // Computed recommendations rendered — hero badge present, honest empty
  // state absent, reason panel explaining the rule-based pick.
  await expect(page.getByText(STRINGS.primaryBadge)).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(STRINGS.emptyDescription)).toHaveCount(0);
  await expect(page.getByText(STRINGS.reasonSummaryTitle)).toBeVisible();

  // The hero CTA points at a concrete problem in the writing workspace.
  await expect(page.locator('a[href*="problem="]').first()).toBeVisible();

  expect(serverErrors).toEqual([]);
});
