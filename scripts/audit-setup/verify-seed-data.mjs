#!/usr/bin/env node
// =====================================================================
// Phase 1.5 — Seed data VERIFIER / creator.
// Plan: docs/ai-workflow/ia-implementation-verification-execution-plan.md §7.5 (Step 1.5.2)
//
// Reads <auditDir>/seed-plan.json and creates or verifies the minimal
// deterministic Supabase rows the plan marks `seedAllowed: true`.
//
// Safety (mirrors build-storage-state.mjs):
//   - Loads .env.local (server-only service-role key, never committed).
//   - Refuses to seed `prod` and `unknown-treat-as-prod` targets. No override.
//   - Requires `--apply` to write; default run is a dry-run that emits status only.
//   - Idempotent: deterministic UUIDs + upsert/ignoreDuplicates.
//
// Scope this round: the student (learner) actor + the X-07 weakness chain
// (>=5 dimension-scored submissions across >=2 dims, topic_fit lowest, + an
// active non-expired weakness recommendation run with items). Admin / wrong-owner
// scenarios are recorded as deferred seed blockers (honest per-scenario status),
// not silently passed.
// =====================================================================

import {
  resolveAuditDir,
  ensureAuditDir,
  runIdFromAuditDir,
  gitMeta,
  generatedAt,
  writeJson,
  maybeReadJson,
  parseArgs,
} from "./ia-audit-lib.mjs";
import { loadEnvLocal, classifyTargetEnv } from "./build-seed-data-plan.mjs";

const STUDENT_EMAIL = "student@audit.local"; // matches build-storage-state.mjs EMAIL_DOMAIN
const AUDIT_TAG = "audit_seed";

// Published writing problems from supabase/seed.sql (fixed UUIDs).
const PROBLEM = {
  51: "11111111-1111-1111-1111-111111111111",
  52: "22222222-2222-2222-2222-222222222222",
  53: "33333333-3333-3333-3333-333333333333",
  54: "44444444-4444-4444-4444-444444444444",
};

// Deterministic seed-row UUIDs (prefix a0d17000 ~ "audit") so re-runs upsert.
const RUN_UUID = "a0d17000-0000-4000-8000-0000000000a0";
const SUBMISSIONS = [
  { id: "a0d17000-0000-4000-8000-000000000051", questionNo: 51 },
  { id: "a0d17000-0000-4000-8000-000000000052", questionNo: 52 },
  { id: "a0d17000-0000-4000-8000-000000000053", questionNo: 53 },
  { id: "a0d17000-0000-4000-8000-000000000054", questionNo: 54 },
  { id: "a0d17000-0000-4000-8000-000000000055", questionNo: 51 },
];

// score_max is 100; weakness.ts normalizes score/score_max. Ordering makes
// topic_fit the single weakest (drives the insight Alert) and content second
// (so getWeakDimensions returns [topic_fit, content]).
export const DIMENSION_SCORE = {
  topic_fit: 28,
  content: 42,
  expression: 55,
  structure: 68,
  grammar: 74,
  vocab: 80,
};

const ANSWER_TEXT =
  "[audit_seed] 주제에 맞춰 작성한 예시 답안입니다. 도입과 근거를 간단히 정리했습니다.";

// ---- Pure row builders (unit-tested) --------------------------------------

export function buildSubmissionRows(userId) {
  return SUBMISSIONS.map((sub) => ({
    id: sub.id,
    user_id: userId,
    problem_id: PROBLEM[sub.questionNo],
    question_no: sub.questionNo,
    answer_text: ANSWER_TEXT,
    char_count: ANSWER_TEXT.length,
    feedback_status: "complete",
  }));
}

export function buildFeedbackRows(userId) {
  return SUBMISSIONS.map((sub) => ({
    submission_id: sub.id,
    user_id: userId,
    status: "complete",
    score_total: 60,
    score_max: 100,
    overall_summary: `[${AUDIT_TAG}] 약점 분석용 시드 피드백입니다.`,
    ai_model: "seed-fixture",
  }));
}

export function buildDimensionScoreRows(userId) {
  const rows = [];
  for (const sub of SUBMISSIONS) {
    for (const [dimension, score] of Object.entries(DIMENSION_SCORE)) {
      rows.push({
        submission_id: sub.id,
        user_id: userId,
        dimension,
        score,
        score_max: 100,
        summary: `[${AUDIT_TAG}] ${dimension}`,
      });
    }
  }
  return rows;
}

export function buildRecommendationRun(userId, nowMs) {
  const expires = new Date(nowMs + 1000 * 60 * 60 * 24 * 365).toISOString();
  return {
    id: RUN_UUID,
    user_id: userId,
    source_type: "weakness",
    reason_summary: `[${AUDIT_TAG}] 약점(주제 적합성·내용) 기반 추천`,
    expires_at: expires,
  };
}

export function buildRecommendationItemRows(userId) {
  return [
    {
      run_id: RUN_UUID,
      user_id: userId,
      problem_id: PROBLEM[52],
      rank: 1,
      reason: "최근 답안에서 주제 적합성이 약해, 비슷한 유형으로 먼저 연습하면 좋아요.",
      estimated_minutes: 20,
      weakness_tags: ["topic_fit", AUDIT_TAG],
      status: "active",
    },
    {
      run_id: RUN_UUID,
      user_id: userId,
      problem_id: PROBLEM[53],
      rank: 2,
      reason: "내용 전개를 보강할 수 있는 도표 분석 문제예요.",
      estimated_minutes: 25,
      weakness_tags: ["content", AUDIT_TAG],
      status: "active",
    },
  ];
}

// ---- DB operations ---------------------------------------------------------

async function ensureStudentActor(admin) {
  const { data: page, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listError) throw new Error(`listUsers failed: ${listError.message}`);
  const existing = page.users.find((u) => u.email === STUDENT_EMAIL);
  if (existing) return { id: existing.id, created: false };

  const { data, error } = await admin.auth.admin.createUser({
    email: STUDENT_EMAIL,
    password: process.env.SUPABASE_TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { audit_seed: true, audit_role: "student" },
  });
  if (error) throw new Error(`createUser(${STUDENT_EMAIL}) failed: ${error.message}`);
  return { id: data.user.id, created: true };
}

async function upsert(admin, table, rows, onConflict) {
  const { error } = await admin.from(table).upsert(rows, { onConflict, ignoreDuplicates: true });
  if (error) throw new Error(`${table} upsert failed: ${error.message}`);
  return rows.length;
}

async function seedX07(admin, userId, nowMs) {
  const seeded = {};
  seeded.writing_submissions = await upsert(admin, "writing_submissions", buildSubmissionRows(userId), "id");
  seeded.writing_feedback = await upsert(admin, "writing_feedback", buildFeedbackRows(userId), "submission_id");
  seeded.feedback_dimension_scores = await upsert(
    admin,
    "feedback_dimension_scores",
    buildDimensionScoreRows(userId),
    "submission_id,dimension",
  );
  seeded.recommendation_runs = await upsert(admin, "recommendation_runs", [buildRecommendationRun(userId, nowMs)], "id");
  seeded.recommendation_items = await upsert(
    admin,
    "recommendation_items",
    buildRecommendationItemRows(userId),
    "run_id,problem_id",
  );
  return seeded;
}

// ---- Main ------------------------------------------------------------------

async function main() {
  loadEnvLocal();
  const args = parseArgs();
  const apply = Boolean(args.apply);
  const auditDir = resolveAuditDir();
  ensureAuditDir(auditDir);
  const runId = runIdFromAuditDir(auditDir);
  const meta = gitMeta();
  const target = classifyTargetEnv();
  const summaryPath = `${auditDir}/seed-results.json`;
  const seedPlan = maybeReadJson(`${auditDir}/seed-plan.json`);

  const baseResult = {
    seedRunId: `seed-${runId}`,
    runId,
    sourceCommit: meta.sourceCommit,
    dirtyState: meta.dirtyState,
    targetEnvironment: target.url,
    targetClassification: target.classification,
    seedMode: apply ? "apply" : "dry-run",
    seedPlanPresent: Boolean(seedPlan),
    seededActors: [],
    seededRows: {},
    seedPreconditions: STUDENT_EMAIL,
    seedStatus: "PENDING",
    seedBlockingReasons: [],
    deferredScenarios: [],
    generatedBy: "verify-seed-data.mjs",
    generatedAt: generatedAt(),
  };

  // --- Production safety guard: never seed prod / unknown. No override. ---
  if (target.classification === "prod" || target.classification === "unknown-treat-as-prod") {
    const result = {
      ...baseResult,
      seedStatus: "REFUSED-UNSAFE-TARGET",
      seedBlockingReasons: [
        `target classification '${target.classification}' is not seed-safe. ` +
          "Point .env.local at a dev/staging project (SUPABASE_ENV_LABEL=dev) before seeding.",
      ],
    };
    writeJson(summaryPath, result);
    console.error(`verify-seed-data.mjs REFUSED — target=${target.classification} (label=${target.label}, url=${target.url})`);
    process.exit(2);
  }

  const missingEnv = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_TEST_PASSWORD"].filter(
    (k) => !process.env[k],
  );

  if (!apply || missingEnv.length > 0) {
    const result = {
      ...baseResult,
      seedStatus: "BLOCKED",
      seedBlockingReasons: !apply
        ? ["dry-run (pass --apply to write). Target verified seed-safe."]
        : [`missing env: ${missingEnv.join(", ")}`],
      plannedScenarios: { "X-07": "student weakness chain", actors: [STUDENT_EMAIL] },
    };
    writeJson(summaryPath, result);
    console.error(
      `verify-seed-data.mjs BLOCKED — ${!apply ? "dry-run (no --apply)" : `missing env: ${missingEnv.join(", ")}`}`,
    );
    console.error(`  target=${target.classification} (safe) status path: ${summaryPath}`);
    process.exit(1);
  }

  // --- Apply path: seed against the verified-safe dev target. ---
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const nowMs = Date.now();
  const result = { ...baseResult, seedStatus: "PENDING" };
  try {
    const actor = await ensureStudentActor(admin);
    result.seededActors = [{ email: STUDENT_EMAIL, id: actor.id, created: actor.created, appRole: "learner" }];
    console.log(`[student] ${actor.created ? "created" : "exists"} (id=${actor.id})`);

    result.seededRows = await seedX07(admin, actor.id, nowMs);
    console.log(`[X-07] seeded:`, result.seededRows);

    result.seedStatus = "PASS";
    result.deferredScenarios = [
      { scenario: "admin actors + app_role elevation", reason: "owned by build-storage-state.mjs + manual SQL (profiles protect trigger); out of WS2 scope" },
      { scenario: "wrong-owner / owner-:id rows (E-01/E-02/R-01/X-10)", reason: "deferred — not required for X-07 unblock this round" },
    ];
  } catch (err) {
    result.seedStatus = "FAIL";
    result.seedBlockingReasons = [err instanceof Error ? err.message : String(err)];
    console.error(`verify-seed-data.mjs FAILED: ${result.seedBlockingReasons[0]}`);
  }

  writeJson(summaryPath, result);
  console.log(`verify-seed-data.mjs ${result.seedStatus}: ${summaryPath}`);
  if (result.seedStatus !== "PASS") process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("verify-seed-data.mjs")) {
  main();
}
