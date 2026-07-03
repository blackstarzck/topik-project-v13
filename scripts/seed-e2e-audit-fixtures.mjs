#!/usr/bin/env node
// Seed the DURABLE e2e audit submissions the authed screen-smoke suite depends
// on (tests/e2e/screens/screens-authed.spec.ts references fixed ids
// a0d17000-...-051 short / a0d17000-...-053 long as "existing audit submissions
// not created by this suite"). Idempotent: re-inserts the two bundles for the
// E2E student. Uses SUPABASE_SERVICE_ROLE_KEY. Non-production only.
//
// Usage: node scripts/seed-e2e-audit-fixtures.mjs   (loads .env.local)

import { readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

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
    // env provided directly (CI)
  }
}

loadEnvLocal();

const { createClient } = await import("@supabase/supabase-js");

const EMAIL = process.env.E2E_STUDENT_EMAIL ?? "student@audit.local";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
const ENV_LABEL = (process.env.SUPABASE_ENV_LABEL ?? "").toLowerCase();

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (ENV_LABEL === "prod" || ENV_LABEL === "production") {
  console.error(`Refusing to seed: SUPABASE_ENV_LABEL=${ENV_LABEL}`);
  process.exit(1);
}

const SUB_SHORT = "a0d17000-0000-4000-8000-000000000051";
const SUB_LONG = "a0d17000-0000-4000-8000-000000000053";

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function findStudent() {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await sb.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;
    const u = data.users.find(
      (c) => c.email?.toLowerCase() === EMAIL.toLowerCase(),
    );
    if (u) return u;
    if (data.users.length < 1000) break;
  }
  throw new Error(`E2E student user not found: ${EMAIL}`);
}

async function publishedProblemId(questionNo) {
  const { data, error } = await sb
    .from("problems")
    .select("id")
    .eq("domain", "writing")
    .eq("question_no", questionNo)
    .eq("publish_status", "published")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error(`No published q${questionNo} problem`);
  return data.id;
}

async function removeExisting(id) {
  await sb.from("sentence_feedback").delete().eq("submission_id", id);
  await sb.from("feedback_dimension_scores").delete().eq("submission_id", id);
  await sb.from("writing_feedback").delete().eq("submission_id", id);
  await sb.from("writing_submissions").delete().eq("id", id);
}

function dimensionRows(id, userId, base) {
  const dims = [
    ["grammar", 72, 4],
    ["vocab", 84, 2],
    ["structure", 76, 3],
    ["content", 88, 1],
    ["expression", 79, 3],
    ["topic_fit", 90, 1],
  ];
  return dims.map(([dimension, score, weakness_level]) => ({
    submission_id: id,
    user_id: userId,
    dimension,
    score: score - base,
    score_max: 100,
    summary: `${dimension} 관련 감사 피드백 항목입니다.`,
    weakness_level,
  }));
}

async function seedShort(userId) {
  const problemId = await publishedProblemId(51);
  await removeExisting(SUB_SHORT);
  const answerText = [
    "저는 회의 일정 때문에 금요일 오후 세 시에 만날 수 있습니다.",
    "장소는 회사 근처 카페가 좋겠습니다.",
  ].join("\n");
  let r = await sb.from("writing_submissions").insert({
    id: SUB_SHORT,
    user_id: userId,
    problem_id: problemId,
    question_no: 51,
    answer_text: answerText,
    char_count: answerText.length,
    feedback_status: "complete",
  });
  if (r.error) throw r.error;
  r = await sb.from("writing_feedback").insert({
    submission_id: SUB_SHORT,
    user_id: userId,
    status: "complete",
    score_total: 82,
    score_max: 100,
    overall_summary:
      "요청한 시간과 장소가 명확합니다. 조사와 연결 표현을 조금 더 자연스럽게 다듬으면 좋습니다.",
    ai_model: "e2e-audit-fixture",
    ai_model_version: "E-01",
  });
  if (r.error) throw r.error;
  r = await sb
    .from("feedback_dimension_scores")
    .insert(dimensionRows(SUB_SHORT, userId, 0));
  if (r.error) throw r.error;
  r = await sb.from("sentence_feedback").insert([
    {
      submission_id: SUB_SHORT,
      user_id: userId,
      sentence_index: 0,
      original_text: "저는 회의 일정 때문에 금요일 오후 세 시에 만날 수 있습니다.",
      corrected_text: "저는 회의 일정 때문에 금요일 오후 3시에 만날 수 있습니다.",
      comment: "시간 표현을 숫자로 정리하면 더 읽기 쉽습니다.",
    },
    {
      submission_id: SUB_SHORT,
      user_id: userId,
      sentence_index: 1,
      original_text: "장소는 회사 근처 카페가 좋겠습니다.",
      corrected_text: "장소는 회사 근처 카페로 하면 좋겠습니다.",
      comment: "제안 표현을 더 자연스럽게 바꿨습니다.",
    },
  ]);
  if (r.error) throw r.error;
}

async function seedLong(userId) {
  const problemId = await publishedProblemId(53);
  await removeExisting(SUB_LONG);
  const answerText = [
    "첫째, 자료에서 가장 큰 변화는 방문자 수 증가입니다.",
    "둘째, 2024년 이후 온라인 신청 비율이 빠르게 높아졌습니다.",
    "그러므로 기관은 모바일 안내를 강화해야 합니다.",
    "또한 오프라인 방문자를 위한 안내도 유지할 필요가 있습니다.",
    "마지막으로 두 방식의 균형을 맞추는 것이 중요합니다.",
  ].join("\n");
  let r = await sb.from("writing_submissions").insert({
    id: SUB_LONG,
    user_id: userId,
    problem_id: problemId,
    question_no: 53,
    answer_text: answerText,
    char_count: answerText.length,
    feedback_status: "complete",
  });
  if (r.error) throw r.error;
  r = await sb.from("writing_feedback").insert({
    submission_id: SUB_LONG,
    user_id: userId,
    status: "complete",
    score_total: 74,
    score_max: 100,
    overall_summary:
      "자료의 변화 방향은 잘 설명했습니다. 단락 전개와 근거 연결을 더 명확히 하면 완성도가 올라갑니다.",
    ai_model: "e2e-audit-fixture",
    ai_model_version: "E-02",
  });
  if (r.error) throw r.error;
  r = await sb
    .from("feedback_dimension_scores")
    .insert(dimensionRows(SUB_LONG, userId, 4));
  if (r.error) throw r.error;
  r = await sb.from("sentence_feedback").insert(
    answerText.split("\n").map((text, index) => ({
      submission_id: SUB_LONG,
      user_id: userId,
      sentence_index: index,
      original_text: text,
      corrected_text: `${text} (수정 제안 ${index + 1})`,
      comment: `문장 ${index + 1}의 연결과 표현을 다듬는 제안입니다.`,
    })),
  );
  if (r.error) throw r.error;
}

async function fourPublishedProblemIds() {
  const { data, error } = await sb
    .from("problems")
    .select("id")
    .eq("domain", "writing")
    .eq("publish_status", "published")
    .order("created_at", { ascending: true })
    .limit(4);
  if (error) throw error;
  if (!data || data.length < 4) throw new Error("need >=4 published problems");
  return data.map((row) => row.id);
}

// Durable weakness recommendations so /practice/weakness renders 4 cards
// (weakness-recommendations X-07 + workspace-layout weakness variant).
async function seedRecommendations(userId) {
  await sb.from("recommendation_items").delete().eq("user_id", userId);
  await sb.from("recommendation_runs").delete().eq("user_id", userId);
  const runId = randomUUID();
  let r = await sb.from("recommendation_runs").insert({
    id: runId,
    user_id: userId,
    source_type: "weakness",
    reason_summary: "약점 기반 추천(감사 fixture)",
    expires_at: null,
  });
  if (r.error) throw r.error;
  const problemIds = await fourPublishedProblemIds();
  const tags = ["grammar", "vocab", "structure", "topic_fit"];
  r = await sb.from("recommendation_items").insert(
    problemIds.map((problem_id, i) => ({
      id: randomUUID(),
      run_id: runId,
      user_id: userId,
      problem_id,
      rank: i + 1,
      reason: `${tags[i]} 약점 보완 추천 문제입니다.`,
      estimated_minutes: 15,
      weakness_tags: [tags[i]],
      status: "active",
    })),
  );
  if (r.error) throw r.error;
}

const student = await findStudent();
await seedShort(student.id);
await seedLong(student.id);
await seedRecommendations(student.id);
console.log(
  `[seed-e2e-audit-fixtures] OK: durable short(${SUB_SHORT}) + long(${SUB_LONG}) feedback bundles + 4 weakness recommendations seeded for ${EMAIL}`,
);
