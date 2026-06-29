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
    throw new Error("Missing Supabase service credentials for E-02 e2e setup");
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

async function createCompletedLongFeedbackSubmission() {
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
    .eq("question_no", 53)
    .eq("publish_status", "published")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (problem.error) throw problem.error;
  if (!problem.data?.id) throw new Error("No published q53 problem found");

  const submissionId = randomUUID();
  const answerText = [
    "첫째, 자료에서 가장 큰 변화는 방문자 수 증가입니다.",
    "둘째, 2024년 이후 온라인 신청 비율이 빠르게 높아졌습니다.",
    "그러므로 기관은 모바일 안내를 강화해야 합니다.",
    "또한 오프라인 방문자를 위한 안내도 유지할 필요가 있습니다.",
    "마지막으로 두 방식의 균형을 맞추는 것이 중요합니다.",
    "이런 변화는 이용자 편의가 중요한 기준이 되었음을 보여 줍니다.",
  ].join("\n");
  const inserted = await sb.from("writing_submissions").insert({
    id: submissionId,
    user_id: user.id,
    problem_id: problem.data.id,
    question_no: 53,
    answer_text: answerText,
    char_count: answerText.length,
    feedback_status: "complete",
  });
  if (inserted.error) throw inserted.error;

  const feedback = await sb.from("writing_feedback").insert({
    submission_id: submissionId,
    user_id: user.id,
    status: "complete",
    score_total: 74,
    score_max: 100,
    overall_summary:
      "자료의 변화 방향은 잘 설명했습니다. 단락 전개와 근거 연결을 더 명확히 하면 완성도가 올라갑니다.",
    ai_model: "e2e-fixture",
    ai_model_version: "E-02",
  });
  if (feedback.error) throw feedback.error;

  const dimensions = await sb.from("feedback_dimension_scores").insert([
    {
      submission_id: submissionId,
      user_id: user.id,
      dimension: "grammar",
      score: 70,
      score_max: 100,
      summary: "문장 호응과 조사 사용을 더 정확히 점검하세요.",
      weakness_level: 4,
    },
    {
      submission_id: submissionId,
      user_id: user.id,
      dimension: "vocab",
      score: 77,
      score_max: 100,
      summary: "자료 설명에 필요한 어휘는 충분하지만 반복이 있습니다.",
      weakness_level: 3,
    },
    {
      submission_id: submissionId,
      user_id: user.id,
      dimension: "structure",
      score: 68,
      score_max: 100,
      summary: "도입과 결론은 있으나 전개 순서를 더 분명히 할 필요가 있습니다.",
      weakness_level: 5,
    },
    {
      submission_id: submissionId,
      user_id: user.id,
      dimension: "content",
      score: 80,
      score_max: 100,
      summary: "자료의 핵심 변화는 잘 반영했습니다.",
      weakness_level: 2,
    },
    {
      submission_id: submissionId,
      user_id: user.id,
      dimension: "expression",
      score: 73,
      score_max: 100,
      summary: "표현은 이해 가능하지만 연결어를 더 다양하게 쓰면 좋습니다.",
      weakness_level: 3,
    },
    {
      submission_id: submissionId,
      user_id: user.id,
      dimension: "topic_fit",
      score: 82,
      score_max: 100,
      summary: "문제의 자료 분석 요구에 대체로 맞습니다.",
      weakness_level: 1,
    },
  ]);
  if (dimensions.error) throw dimensions.error;

  const sentenceRows = answerText.split("\n").map((text, index) => ({
    submission_id: submissionId,
    user_id: user.id,
    sentence_index: index,
    original_text: text,
    corrected_text: `${text} (수정 제안 ${index + 1})`,
    comment: `문장 ${index + 1}의 연결과 표현을 다듬는 제안입니다.`,
  }));
  const sentences = await sb.from("sentence_feedback").insert(sentenceRows);
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
  "E-02 e2e requires Supabase service credentials for an isolated feedback row",
);

test("E-02 long feedback matches the wireframe constraints", async ({ page }) => {
  const errors = collectErrors(page);
  const submissionId = await createCompletedLongFeedbackSubmission();

  await page.goto(`/writing/feedback/long/${submissionId}`, {
    waitUntil: "networkidle",
  });
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.locator(".app-workspace-sider")).toHaveCount(0);
  await expect(
    page.locator(".app-notification-corner, .app-workspace-mobile-actions"),
  ).toHaveCount(0);

  await expect(page.getByTestId("feedback-summary")).toBeVisible();
  await expect(page.locator(".ant-statistic")).toBeVisible();
  await expect(page.getByTestId("feedback-summary-meta").locator(".ant-tag")).toHaveCount(4);
  await expect(page.getByTestId("feedback-dimension-card")).toHaveCount(0);

  const sentenceCard = page.getByTestId("feedback-sentence-card");
  await expect(sentenceCard).toBeVisible();
  await expect(sentenceCard.getByRole("listitem")).toHaveCount(5);
  await expect(sentenceCard.getByRole("button")).toBeVisible();

  await expect(page.getByTestId("feedback-detail-panel")).toBeVisible();
  await expect(page.getByTestId("feedback-detail-item")).toHaveCount(5);
  expect(await page.locator('[data-testid^="feedback-reco-"]').count()).toBeLessThanOrEqual(3);

  const actions = page.locator(
    [
      '[data-testid="feedback-action-retry"]',
      '[data-testid="feedback-action-next"]',
      '[data-testid="feedback-action-save"]',
      '[data-testid="feedback-action-compare"]',
    ].join(","),
  );
  await expect(actions).toHaveCount(4);
  await expect(page.getByTestId("feedback-action-retry")).toHaveText("다시 작성");

  expect(errors).toEqual([]);
});
