import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
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
    // CI without .env.local skips through the explicit env guard below.
  }
}

loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const RUN_TOKEN = `writing-52-flow-${randomUUID()}`;

const FLOW_DIMENSIONS = [
  ["grammar", 78, 3],
  ["vocab", 81, 2],
  ["structure", 80, 2],
  ["content", 84, 2],
  ["expression", 82, 2],
  ["topic_fit", 86, 1],
] as const;

type FlowSubmission = {
  id: string;
  user_id: string;
  problem_id: string;
  question_no: number;
  answer_text: string;
  char_count: number;
  submitted_at: string;
};

function serviceClient() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error("Missing Supabase service credentials for writing 52 flow");
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const createdSubmissionIds: string[] = [];

async function waitForSubmittedFlowRow(answerToken: string) {
  const sb = serviceClient();
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    const { data, error } = await sb
      .from("writing_submissions")
      .select(
        "id,user_id,problem_id,question_no,answer_text,char_count,submitted_at",
      )
      .like("answer_text", `%${answerToken}%`)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) return data as FlowSubmission;
    await wait(500);
  }

  throw new Error("Timed out waiting for the writing 52 submission row");
}

async function completeSubmittedFlowRow(submission: FlowSubmission) {
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
    score_total: 82,
    score_max: 100,
    overall_summary:
      "Writing 52 flow fixture feedback confirms the submitted answer can route to feedback.",
    ai_model: "e2e-fixture",
    ai_model_version: "writing-52-flow",
  });
  if (feedback.error) throw feedback.error;

  const dimensions = await sb.from("feedback_dimension_scores").insert(
    FLOW_DIMENSIONS.map(([dimension, score, weaknessLevel]) => ({
      submission_id: submission.id,
      user_id: submission.user_id,
      dimension,
      score,
      score_max: 100,
      summary: `Writing 52 flow ${dimension} feedback.`,
      weakness_level: weaknessLevel,
    })),
  );
  if (dimensions.error) throw dimensions.error;

  const sentences = await sb.from("sentence_feedback").insert([
    {
      submission_id: submission.id,
      user_id: submission.user_id,
      sentence_index: 0,
      original_text: submission.answer_text,
      corrected_text: submission.answer_text,
      comment: "Writing 52 flow fixture sentence feedback.",
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
  "writing 52 flow requires Supabase service credentials for cleanup and analysis completion fixture",
);

test.afterAll(async () => {
  if (createdSubmissionIds.length === 0) return;
  const label = (process.env.SUPABASE_ENV_LABEL || "").toLowerCase();
  if (label === "prod" || label === "production") return;
  const sb = serviceClient();
  for (const id of createdSubmissionIds) {
    await sb.from("library_items").delete().eq("submission_id", id);
    await sb.from("sentence_feedback").delete().eq("submission_id", id);
    await sb.from("feedback_dimension_scores").delete().eq("submission_id", id);
    await sb.from("writing_feedback").delete().eq("submission_id", id);
    await sb.from("writing_submissions").delete().eq("id", id);
  }
});

test("writing 52 flow: write, submit, analyze, and route to short feedback", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  test.skip(
    testInfo.project.name !== "desktop-1280",
    "writing 52 submit flow runs once on desktop-1280",
  );

  const answerToken = `${RUN_TOKEN}-${testInfo.retry}`;
  const firstBlankAnswer = `Writing 52 first blank answer ${answerToken}`;
  const secondBlankAnswer =
    "Writing 52 second blank links the passage condition naturally.";
  const completedAnalysisSubmissionIds = new Set<string>();

  await page.route(
    "**/api/writing/evaluation-status?submissionId=*",
    async (route) => {
      const url = new URL(route.request().url());
      const submissionId = url.searchParams.get("submissionId");
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          feedback_status:
            submissionId && completedAnalysisSubmissionIds.has(submissionId)
              ? "complete"
              : "analyzing",
        }),
      });
    },
  );

  await page.goto("/writing/answer-writing-52", {
    waitUntil: "networkidle",
  });
  await expect(page).not.toHaveURL(/\/login/);

  const workspace = page.locator(".writing-workspace--q52");
  await expect(workspace).toBeVisible();
  await expect(workspace.locator(".writing-guide-accordion")).toBeVisible();
  const textarea = workspace.locator("textarea").first();
  await textarea.fill(firstBlankAnswer);
  await workspace.getByRole("tab").nth(1).click();
  await textarea.fill(secondBlankAnswer);

  const submitButton = page.locator(".writing-exam-header__submit-button");
  await expect(submitButton).toBeEnabled();
  await submitButton.click();

  const confirmModal = page.getByTestId("submission-confirm-modal");
  await expect(confirmModal).toBeVisible();
  await confirmModal.getByTestId("submission-confirm-submit").click();

  await expect(page).toHaveURL(/\/writing\/answer-writing-52/);
  await expect(page.getByTestId("analysis-loading-page")).toBeVisible();
  const submitted = await waitForSubmittedFlowRow(answerToken);
  expect(submitted.question_no).toBe(52);
  createdSubmissionIds.push(submitted.id);

  await completeSubmittedFlowRow(submitted);
  completedAnalysisSubmissionIds.add(submitted.id);
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
  });

  await page.waitForURL(/\/writing\/feedback\/short\/[0-9a-f-]+/, {
    timeout: 30_000,
  });
  expect(page.url()).toContain(submitted.id);
  await expect(page.getByRole("heading").first()).toBeVisible();
});
