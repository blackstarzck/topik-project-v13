import { readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

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
    // CI without .env.local will skip through the explicit env guard below.
  }
}

loadEnvLocal();

const EMAIL = process.env.E2E_STUDENT_EMAIL ?? "student@audit.local";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
const createdSubmissionIds: string[] = [];

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });
  return errors;
}

function serviceClient() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error("Missing Supabase service credentials for E-01 e2e setup");
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

async function createCompletedShortFeedbackSubmission() {
  const sb = serviceClient();
  const users = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) throw users.error;
  const user = users.data.users.find(
    (candidate) => candidate.email?.toLowerCase() === EMAIL.toLowerCase(),
  );
  if (!user) throw new Error(`E2E student user not found: ${EMAIL}`);

  const problem = await sb
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

  const submissionId = randomUUID();
  const answerText = [
    "저는 회의 일정 때문에 금요일 오후 세 시에 만날 수 있습니다.",
    "장소는 회사 근처 카페가 좋겠습니다.",
  ].join("\n");
  const inserted = await sb.from("writing_submissions").insert({
    id: submissionId,
    user_id: user.id,
    problem_id: problem.data.id,
    question_no: 51,
    answer_text: answerText,
    char_count: answerText.length,
    feedback_status: "complete",
  });
  if (inserted.error) throw inserted.error;

  const feedback = await sb.from("writing_feedback").insert({
    submission_id: submissionId,
    user_id: user.id,
    status: "complete",
    score_total: 82,
    score_max: 100,
    overall_summary:
      "요청한 시간과 장소가 명확합니다. 조사와 연결 표현을 조금 더 자연스럽게 다듬으면 좋습니다.",
    ai_model: "e2e-fixture",
    ai_model_version: "E-01",
    raw_ai_result: {
      time_spent: 1127,
      processing_time_seconds: 14.32,
    },
  });
  if (feedback.error) throw feedback.error;

  const dimensions = await sb.from("feedback_dimension_scores").insert([
    {
      submission_id: submissionId,
      user_id: user.id,
      dimension: "grammar",
      score: 72,
      score_max: 100,
      summary: "조사 선택을 조금 더 정확히 하면 자연스럽습니다.",
      weakness_level: 4,
    },
    {
      submission_id: submissionId,
      user_id: user.id,
      dimension: "vocab",
      score: 84,
      score_max: 100,
      summary: "상황에 맞는 단어를 안정적으로 사용했습니다.",
      weakness_level: 2,
    },
    {
      submission_id: submissionId,
      user_id: user.id,
      dimension: "structure",
      score: 76,
      score_max: 100,
      summary: "문장 연결이 대체로 분명하지만 순서를 더 다듬을 수 있습니다.",
      weakness_level: 3,
    },
    {
      submission_id: submissionId,
      user_id: user.id,
      dimension: "content",
      score: 88,
      score_max: 100,
      summary: "필수 정보를 빠짐없이 담았습니다.",
      weakness_level: 1,
    },
    {
      submission_id: submissionId,
      user_id: user.id,
      dimension: "expression",
      score: 79,
      score_max: 100,
      summary: "표현은 자연스럽지만 더 공손하게 바꿀 수 있습니다.",
      weakness_level: 3,
    },
    {
      submission_id: submissionId,
      user_id: user.id,
      dimension: "topic_fit",
      score: 90,
      score_max: 100,
      summary: "문제 상황에 잘 맞는 답안입니다.",
      weakness_level: 1,
    },
  ]);
  if (dimensions.error) throw dimensions.error;

  const sentences = await sb.from("sentence_feedback").insert([
    {
      submission_id: submissionId,
      user_id: user.id,
      sentence_index: 0,
      original_text: "저는 회의 일정 때문에 금요일 오후 세 시에 만날 수 있습니다.",
      corrected_text: "저는 회의 일정 때문에 금요일 오후 3시에 만날 수 있습니다.",
      comment: "시간 표현을 숫자로 정리하면 더 읽기 쉽습니다.",
    },
    {
      submission_id: submissionId,
      user_id: user.id,
      sentence_index: 1,
      original_text: "장소는 회사 근처 카페가 좋겠습니다.",
      corrected_text: "장소는 회사 근처 카페로 하면 좋겠습니다.",
      comment: "제안 표현을 더 자연스럽게 바꿨습니다.",
    },
  ]);
  if (sentences.error) throw sentences.error;

  createdSubmissionIds.push(submissionId);
  return submissionId;
}

test.afterAll(async () => {
  if (createdSubmissionIds.length === 0) return;
  const label = (process.env.SUPABASE_ENV_LABEL || "").toLowerCase();
  if (label === "prod" || label === "production") return;
  const sb = serviceClient();
  for (const id of createdSubmissionIds) {
    await sb.from("sentence_feedback").delete().eq("submission_id", id);
    await sb.from("feedback_dimension_scores").delete().eq("submission_id", id);
    await sb.from("writing_feedback").delete().eq("submission_id", id);
    await sb.from("writing_submissions").delete().eq("id", id);
  }
});

test.skip(
  !SUPABASE_URL || !SERVICE_KEY,
  "E-01 e2e requires Supabase service credentials for an isolated feedback row",
);

test("E-01 short feedback matches the wireframe constraints", async ({ page }) => {
  const errors = collectErrors(page);
  const submissionId = await createCompletedShortFeedbackSubmission();

  await page.goto(`/writing/feedback/short/${submissionId}`, {
    waitUntil: "networkidle",
  });
  await expect(page).not.toHaveURL(/\/login/);

  await expect(page.getByTestId("feedback-report-overview")).toBeVisible();
  await expect(page.getByText(/소요 시간/)).toBeVisible();
  await expect(page.locator(".ant-statistic")).toBeVisible();
  await expect(page.getByTestId("feedback-report-score-item")).toHaveCount(4);
  await expect(page.getByTestId("feedback-dimension-card")).toHaveCount(0);
  await expect(page.getByTestId("feedback-sentence-card")).toBeVisible();
  await expect(page.locator('[data-testid^="feedback-reco-"]')).toHaveCount(3);

  const actions = page.locator(
    [
      '[data-testid="feedback-action-retry"]',
      '[data-testid="feedback-action-next"]',
      '[data-testid="feedback-action-save"]',
      '[data-testid="feedback-action-compare"]',
    ].join(","),
  );
  await expect(actions).toHaveCount(4);
  await expect(page.getByTestId("feedback-action-retry")).toHaveText("다시 풀기");
  await expect(page.getByTestId("feedback-action-next")).toBeVisible();
  await expect(page.getByTestId("feedback-action-save")).toBeVisible();
  await expect(page.getByTestId("feedback-action-compare")).toBeVisible();

  expect(errors).toEqual([]);
});
