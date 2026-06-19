import { readFileSync } from "node:fs";
import path from "node:path";
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
    // Local e2e runs load .env.local; CI envs can provide the same variables.
  }
}

loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

const createdSubmissionIds: string[] = [];

const Q54_DIMENSIONS = [
  ["topic_fit", 86, 2],
  ["structure", 82, 2],
  ["content", 80, 3],
  ["grammar", 74, 4],
  ["vocab", 78, 3],
  ["expression", 81, 2],
] as const;

type FlowSubmission = {
  id: string;
  user_id: string;
  answer_text: string;
  char_count: number;
  question_no: number;
};

function serviceClient() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error(
      "Missing Supabase service credentials for Q54 writing flow",
    );
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });
  return errors;
}

async function waitForSubmittedQ54Row(answerToken: string) {
  const sb = serviceClient();
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    const { data, error } = await sb
      .from("writing_submissions")
      .select("id,user_id,answer_text,char_count,question_no")
      .eq("question_no", 54)
      .like("answer_text", `%${answerToken}%`)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) return data as FlowSubmission;
    await wait(500);
  }

  throw new Error("Timed out waiting for the Q54 writing submission");
}

async function completeSubmittedQ54Row(submission: FlowSubmission) {
  const sb = serviceClient();

  await sb
    .from("sentence_feedback")
    .delete()
    .eq("submission_id", submission.id);
  await sb
    .from("feedback_dimension_scores")
    .delete()
    .eq("submission_id", submission.id);
  await sb.from("writing_feedback").delete().eq("submission_id", submission.id);

  const feedback = await sb.from("writing_feedback").insert({
    submission_id: submission.id,
    user_id: submission.user_id,
    status: "complete",
    score_total: 83,
    score_max: 100,
    overall_summary:
      "Q54 flow fixture feedback confirms the submitted essay reaches long-form feedback.",
    ai_model: "e2e-fixture",
    ai_model_version: "q54-flow",
  });
  if (feedback.error) throw feedback.error;

  const dimensions = await sb.from("feedback_dimension_scores").insert(
    Q54_DIMENSIONS.map(([dimension, score, weaknessLevel]) => ({
      submission_id: submission.id,
      user_id: submission.user_id,
      dimension,
      score,
      score_max: 100,
      summary: `Q54 flow ${dimension} feedback.`,
      weakness_level: weaknessLevel,
    })),
  );
  if (dimensions.error) throw dimensions.error;

  const sentences = await sb.from("sentence_feedback").insert([
    {
      submission_id: submission.id,
      user_id: submission.user_id,
      sentence_index: 0,
      original_text: submission.answer_text.slice(0, 120),
      corrected_text: submission.answer_text.slice(0, 120),
      comment: "Q54 flow fixture sentence feedback.",
    },
  ]);
  if (sentences.error) throw sentences.error;

  const status = await sb
    .from("writing_submissions")
    .update({ feedback_status: "complete" })
    .eq("id", submission.id);
  if (status.error) throw status.error;
}

test.skip(
  !SUPABASE_URL || !SERVICE_KEY,
  "Q54 writing flow requires Supabase service credentials for cleanup and analysis completion fixture",
);

test.afterAll(async () => {
  if (createdSubmissionIds.length === 0) return;
  const label = (process.env.SUPABASE_ENV_LABEL || "").toLowerCase();
  if (label === "prod" || label === "production") return;
  const sb = serviceClient();
  for (const id of createdSubmissionIds) {
    await sb
      .from("comparison_reports")
      .delete()
      .eq("current_submission_id", id);
    await sb.from("library_items").delete().eq("submission_id", id);
    await sb.from("sentence_feedback").delete().eq("submission_id", id);
    await sb.from("feedback_dimension_scores").delete().eq("submission_id", id);
    await sb.from("writing_feedback").delete().eq("submission_id", id);
    await sb.from("writing_submissions").delete().eq("id", id);
  }
});

test("Q54 essay writing submits and reaches long-form feedback", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-1280",
    "Q54 submit flow runs once on desktop-1280",
  );
  const errors = collectErrors(page);
  const answerToken = `q54-flow-${Date.now()}-${testInfo.retry}`;
  const answerText = [
    `Q54 flow token ${answerToken}.`,
    "알고리즘 추천 서비스는 이용자가 필요한 정보를 빠르게 찾도록 도와준다는 점에서 분명한 장점이 있다.",
    "그러나 기록과 취향을 계속 분석하기 때문에 사용자가 한쪽 의견에만 갇히거나 개인정보가 과도하게 사용될 위험도 있다.",
    "따라서 추천 결과를 그대로 따르기보다 출처와 기준을 확인하고, 서비스 제공자는 설명 가능성과 선택권을 함께 보장해야 한다.",
    "이렇게 사용할 때 추천 서비스는 편리함을 주면서도 이용자의 판단 능력을 해치지 않는 도구가 될 수 있고, 사회 전체의 정보 활용 수준도 높일 수 있다.",
  ].join("\n\n");
  expect(answerText.length).toBeGreaterThanOrEqual(300);
  expect(answerText.length).toBeLessThanOrEqual(700);

  let allowStatusChecks = false;
  const pendingStatusChecks: Array<() => void> = [];
  await page.route("**/api/writing/evaluation-status?**", async (route) => {
    if (!allowStatusChecks) {
      await new Promise<void>((resolve) => pendingStatusChecks.push(resolve));
    }
    await route.continue();
  });
  const releaseStatusChecks = () => {
    allowStatusChecks = true;
    for (const resolve of pendingStatusChecks.splice(0)) resolve();
  };

  try {
    await page.goto("/writing/essay-writing-54?fresh=1", {
      waitUntil: "domcontentloaded",
    });
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL(/essay-writing-54/);
    const q54Guidance = page.getByTestId("q54-guidance-accordion");
    await expect(q54Guidance).toBeVisible();
    await expect(q54Guidance.getByText("글의 구조 제안")).toBeVisible();
    await expect(q54Guidance.getByText("작성 체크 포인트")).toBeVisible();

    const answerTextbox = page.getByRole("textbox", { name: "에세이 본문" });
    await answerTextbox.fill(answerText);
    await expect(answerTextbox).toHaveValue(answerText);
    await expect(
      page.getByRole("button", { name: "제출하기", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "제출하기", exact: true }).click();

    const confirmModal = page.getByTestId("submission-confirm-modal");
    await expect(confirmModal).toBeVisible();
    await expect(
      confirmModal.getByRole("heading", { name: "답안을 제출하시겠어요?" }),
    ).toBeVisible();
    await confirmModal.getByTestId("submission-confirm-submit").click();

    await expect(page).toHaveURL(/\/writing\/essay-writing-54/);
    await expect(page.getByTestId("analysis-loading-background")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByTestId("analysis-loading-page")).toBeVisible();
    await expect(page.getByTestId("analysis-loading-panel")).toBeVisible();
    await expect(page.getByTestId("analysis-loading-modal")).toHaveCount(0);

    const submitted = await waitForSubmittedQ54Row(answerToken);
    createdSubmissionIds.push(submitted.id);
    expect(submitted.question_no).toBe(54);
    expect(submitted.answer_text).toContain(answerToken);
    expect(submitted.char_count).toBe(answerText.length);
    await completeSubmittedQ54Row(submitted);
    releaseStatusChecks();

    await page.waitForURL(/\/writing\/feedback\/long\/[0-9a-f-]+/, {
      timeout: 30000,
    });
    expect(page.url()).toContain(`/writing/feedback/long/${submitted.id}`);
    await expect(page.getByTestId("feedback-summary")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("Q54 flow fixture feedback")).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    releaseStatusChecks();
  }
});
