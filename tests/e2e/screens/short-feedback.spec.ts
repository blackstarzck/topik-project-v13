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
    .eq("question_no", 52)
    .eq("publish_status", "published")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (problem.error) throw problem.error;
  if (!problem.data?.id) throw new Error("No published q52 problem found");

  const submissionId = randomUUID();
  // 실제 52 제출과 동일하게 build52AnswerText 형식("ㄱ: …\nㄴ: …")으로 저장한다.
  // provider annotation은 세 조각이지만 제출 답안은 두 빈칸 전체 문자열로 표시돼야 한다.
  const answerText = [
    "ㄱ: 정리하지 않으면",
    "ㄴ: 꼼꼼하게 정리하는 것이 좋다",
  ].join("\n");
  const inserted = await sb.from("writing_submissions").insert({
    id: submissionId,
    user_id: user.id,
    problem_id: problem.data.id,
    question_no: 52,
    answer_text: answerText,
    char_count: answerText.length,
    feedback_status: "complete",
  });
  if (inserted.error) throw inserted.error;

  const feedback = await sb.from("writing_feedback").insert({
    submission_id: submissionId,
    user_id: user.id,
    status: "complete",
    score_total: 8,
    score_max: 10,
    overall_summary:
      "두 빈칸의 내용은 적절하며 문장 종결 표현을 보완하면 좋습니다.",
    ai_model: "e2e-fixture",
    ai_model_version: "E-01",
    raw_ai_result: {
      time_spent: 1127,
      processing_time_seconds: 14.32,
      trait_scores: [
        {
          trait: "blank_1",
          score: 4,
          max_score: 5,
          feedback: "첫 번째 빈칸은 문맥에 맞게 작성했습니다.",
        },
        {
          trait: "blank_2",
          score: 4,
          max_score: 5,
          feedback: "두 번째 빈칸은 종결 표현을 다듬어 보세요.",
        },
      ],
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
      original_text: "정리하지 않으면",
      corrected_text: "정리하지 않으면",
      comment: "첫 번째 빈칸 교정",
    },
    {
      submission_id: submissionId,
      user_id: user.id,
      sentence_index: 1,
      original_text: "꼼꼼하게",
      corrected_text: "꼼꼼하게",
      comment: "두 번째 빈칸 교정 1",
    },
    {
      submission_id: submissionId,
      user_id: user.id,
      sentence_index: 2,
      original_text: "좋다",
      corrected_text: "좋습니다",
      comment: "두 번째 빈칸 교정 2",
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

test("E-01 short feedback matches the wireframe constraints", async ({
  page,
}) => {
  const errors = collectErrors(page);
  const submissionId = await createCompletedShortFeedbackSubmission();

  await page.goto(`/writing/feedback/short/${submissionId}`, {
    waitUntil: "networkidle",
  });
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.locator(".app-workspace-sider")).toHaveCount(0);
  await expect(
    page.locator(".app-notification-corner, .app-workspace-mobile-actions"),
  ).toHaveCount(0);

  await expect(
    page.getByText("두 빈칸 답안을 기준으로 분석했어요."),
  ).toHaveCount(0);
  const headerTitle = page
    .getByTestId("feedback-page-header")
    .getByRole("heading");
  await expect(headerTitle).toHaveCSS("margin-bottom", "0px");
  const headerQuestionNo = page.getByTestId("feedback-title-question-no");
  await expect(headerQuestionNo).toHaveText("52");
  await expect(headerQuestionNo).toHaveCSS("font-family", /Space Grotesk/);
  await expect(headerQuestionNo).toHaveCSS(
    "background-image",
    /neon-blue\.png/,
  );
  await expect(page.getByTestId("feedback-report-overview")).toHaveCount(0);
  await expect(page.getByTestId("feedback-report-criteria-card")).toBeVisible();
  await expect(page.getByTestId("feedback-report-focus-card")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 5, name: "빈칸별 점수" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 5, name: "다음 보완 포인트" }),
  ).toBeVisible();
  await expect(page.getByTestId("feedback-report-meta")).toHaveCount(0);
  await expect(page.getByText("score와 weight 기준")).toHaveCount(0);
  await expect(page.getByTestId("feedback-summary")).toContainText("총평 점수");
  await expect(
    page.getByTestId("feedback-summary-meta").locator(".ant-tag"),
  ).toHaveCount(4);
  await expect(
    page
      .getByTestId("feedback-summary")
      .locator(".ant-typography")
      .filter({ hasText: "두 빈칸의 내용은 적절하며" }),
  ).not.toHaveClass(/ant-typography-ellipsis/);
  await expect(
    page
      .getByTestId("feedback-summary-score")
      .locator(".ant-statistic-content-value"),
  ).toHaveCSS("font-size", "46px");
  await expect(
    page
      .getByTestId("feedback-summary-score")
      .locator(".ant-statistic-content-value"),
  ).toHaveCSS("font-weight", "700");
  await expect(
    page.getByTestId("feedback-report-total-score-card"),
  ).toHaveCount(0);
  await expect(
    page.getByTestId("feedback-report-total-score-line"),
  ).toHaveCount(0);
  const criteriaCard = page.getByTestId("feedback-report-criteria-card");
  const focusCard = page.getByTestId("feedback-report-focus-card");
  await expect(criteriaCard).not.toHaveClass(/bg-surface\/40/);
  await expect(focusCard).not.toHaveClass(/bg-surface\/40/);
  await expect(focusCard).not.toHaveClass(/rounded-default/);
  await expect(focusCard).not.toHaveClass(/p-4/);
  const criteriaBox = await criteriaCard.boundingBox();
  const focusBox = await focusCard.boundingBox();
  expect(criteriaBox).not.toBeNull();
  expect(focusBox).not.toBeNull();
  expect(focusBox!.y).toBeGreaterThan(criteriaBox!.y + criteriaBox!.height - 1);
  const scoreItems = page.getByTestId("feedback-report-score-item");
  await expect(scoreItems).toHaveCount(2);
  await expect(scoreItems.nth(0)).toContainText("제출 답안");
  await expect(scoreItems.nth(0)).toContainText("정리하지 않으면");
  await expect(scoreItems.nth(1)).toContainText("제출 답안");
  await expect(scoreItems.nth(1)).toContainText("꼼꼼하게 정리하는 것이 좋다");
  await expect(page.getByTestId("feedback-dimension-card")).toHaveCount(0);
  await expect(page.getByTestId("feedback-sentence-card")).toHaveCount(0);
  await expect(page.getByText("Before (내 답안)")).toHaveCount(0);
  await expect(page.locator('[data-testid^="feedback-reco-"]')).toHaveCount(3);
  await expect(
    page.getByRole("heading", { level: 5, name: "추천 학습" }),
  ).toBeVisible();

  const actions = page.locator(
    [
      '[data-testid="feedback-action-retry"]',
      '[data-testid="feedback-action-next"]',
      '[data-testid="feedback-action-pdf"]',
      '[data-testid="feedback-action-compare"]',
    ].join(","),
  );
  await expect(actions).toHaveCount(4);
  await expect(page.getByTestId("feedback-action-retry")).toHaveText(
    "다시 풀기",
  );
  await expect(page.getByTestId("feedback-action-next")).toBeVisible();
  await expect(page.getByTestId("feedback-action-pdf")).toHaveText("PDF 저장");
  await expect(page.getByTestId("feedback-action-save")).toHaveCount(0);
  await expect(page.getByTestId("feedback-action-compare")).toBeVisible();
  await expect(page.getByTestId("feedback-header-back-link")).toHaveAttribute(
    "href",
    "/library",
  );
  await expect(page.getByTestId("feedback-header-back-link")).toHaveAttribute(
    "aria-label",
    "내 서재로 돌아가기",
  );
  await page.getByTestId("feedback-header-back-link").click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByRole("heading", { name: "내 서재" })).toBeVisible();

  expect(errors).toEqual([]);
});

test("E-01 short feedback next action starts a fresh direct writing attempt", async ({
  page,
}) => {
  const errors = collectErrors(page);
  const submissionId = await createCompletedShortFeedbackSubmission();

  await page.goto(`/writing/feedback/short/${submissionId}`, {
    waitUntil: "networkidle",
  });

  await page.getByTestId("feedback-action-next").click();
  await page.waitForURL((url) => {
    return (
      url.pathname === "/writing/answer-writing-52" &&
      Boolean(url.searchParams.get("problem")) &&
      url.searchParams.get("fresh") === "1" &&
      url.searchParams.get("retrySubmission") === null
    );
  });
  expect(page.url()).not.toContain("/practice/next");

  expect(errors).toEqual([]);
});
