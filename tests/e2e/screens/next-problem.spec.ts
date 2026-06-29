import { randomUUID } from "node:crypto";
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
    // CI without .env.local will skip through the explicit env guard below.
  }
}

loadEnvLocal();

const EMAIL = process.env.E2E_STUDENT_EMAIL ?? "student@audit.local";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
const createdRunIds: string[] = [];
const createdSubmissionIds: string[] = [];
const createdProblemIds: string[] = [];

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
    throw new Error("Missing Supabase service credentials for R-02 e2e setup");
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

async function createNextProblemFixture() {
  const sb = serviceClient();
  const users = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) throw users.error;
  const user = users.data.users.find(
    (candidate) => candidate.email?.toLowerCase() === EMAIL.toLowerCase(),
  );
  if (!user) throw new Error(`E2E student user not found: ${EMAIL}`);

  const marker = `e2e-next-${randomUUID().slice(0, 8)}`;
  const createdAt = new Date(Date.now() + 90_000).toISOString();
  const problemRows = [51, 52, 53, 54].map((questionNo, index) => ({
    id: randomUUID(),
    source: "curated" as const,
    domain: "writing" as const,
    question_no: questionNo,
    topik_level: 2,
    difficulty: 2 + index,
    title: `E2E next ${marker} ${questionNo}`,
    prompt: "다음 안내문을 읽고 알맞은 내용을 쓰십시오.",
    materials: { question_id: `${marker}-${questionNo}` },
    answer_key: null,
    rubric: {},
    tags: [marker, "e2e-next-problem"],
    publish_status: "published" as const,
    review_status: "approved" as const,
    visibility: "public" as const,
    lifecycle_status: "active" as const,
    created_at: createdAt,
    updated_at: createdAt,
  }));
  const problems = await sb
    .from("problems")
    .insert(problemRows)
    .select("id, question_no");
  if (problems.error) throw problems.error;
  createdProblemIds.push(...problemRows.map((problem) => problem.id));

  const submissionId = randomUUID();
  const runId = randomUUID();
  const answerText =
    "This completed submission gives the recommendation screen score context.";

  const submission = await sb.from("writing_submissions").insert({
    id: submissionId,
    user_id: user.id,
    problem_id: problems.data[0].id,
    question_no: problems.data[0].question_no ?? 53,
    answer_text: answerText,
    char_count: answerText.length,
    feedback_status: "complete",
  });
  if (submission.error) throw submission.error;

  const feedback = await sb.from("writing_feedback").insert({
    submission_id: submissionId,
    user_id: user.id,
    status: "complete",
    score_total: 72,
    score_max: 100,
    overall_summary: "Fixture feedback for R-02 summary cards.",
    ai_model: "e2e-fixture",
    ai_model_version: "R-02",
  });
  if (feedback.error) throw feedback.error;

  const dimensions = await sb.from("feedback_dimension_scores").insert([
    {
      submission_id: submissionId,
      user_id: user.id,
      dimension: "grammar",
      score: 58,
      score_max: 100,
      summary: "Grammar is the weakest area.",
      weakness_level: 5,
    },
    {
      submission_id: submissionId,
      user_id: user.id,
      dimension: "structure",
      score: 66,
      score_max: 100,
      summary: "Structure needs more practice.",
      weakness_level: 4,
    },
    {
      submission_id: submissionId,
      user_id: user.id,
      dimension: "content",
      score: 70,
      score_max: 100,
      summary: "Content is acceptable.",
      weakness_level: 3,
    },
  ]);
  if (dimensions.error) throw dimensions.error;

  const run = await sb.from("recommendation_runs").insert({
    id: runId,
    user_id: user.id,
    source_type: "next_problem",
    reason_summary: "R-02 e2e isolated next-problem run",
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
  });
  if (run.error) throw run.error;

  const items = await sb.from("recommendation_items").insert(
    problems.data.map((problem, index) => ({
      run_id: runId,
      user_id: user.id,
      problem_id: problem.id,
      rank: -100 + index,
      reason:
        index === 0
          ? "This problem follows the weakest grammar and structure signals from the latest completed answer."
          : "This alternative keeps the learner near the same writing practice context.",
      estimated_minutes: 12 + index * 3,
      weakness_tags: ["grammar", "structure"],
      status: "active",
    })),
  );
  if (items.error) throw items.error;

  createdSubmissionIds.push(submissionId);
  createdRunIds.push(runId);
}

test.afterAll(async () => {
  if (
    createdSubmissionIds.length === 0 &&
    createdRunIds.length === 0 &&
    createdProblemIds.length === 0
  ) {
    return;
  }
  const label = (process.env.SUPABASE_ENV_LABEL || "").toLowerCase();
  if (label === "prod" || label === "production") return;
  const sb = serviceClient();
  for (const id of createdRunIds) {
    await sb.from("recommendation_runs").delete().eq("id", id);
  }
  for (const id of createdSubmissionIds) {
    await sb.from("feedback_dimension_scores").delete().eq("submission_id", id);
    await sb.from("writing_feedback").delete().eq("submission_id", id);
    await sb.from("writing_submissions").delete().eq("id", id);
  }
  if (createdProblemIds.length > 0) {
    await sb.from("problems").delete().in("id", createdProblemIds);
  }
});

test.skip(
  !SUPABASE_URL || !SERVICE_KEY,
  "R-02 e2e requires Supabase service credentials for isolated recommendation rows",
);

test("R-02 next problem recommendation matches the wireframe constraints", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await createNextProblemFixture();

  await page.goto("/practice/next", { waitUntil: "networkidle" });
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.locator(".app-workspace-sider")).toHaveCount(0);
  await expect(
    page.locator(".app-notification-corner, .app-workspace-mobile-actions"),
  ).toHaveCount(0);

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByTestId("next-summary-card")).toHaveCount(3);
  const summaryCardHeights = await page
    .getByTestId("next-summary-card")
    .evaluateAll((cards) =>
      cards.map((card) => card.getBoundingClientRect().height),
    );
  expect(
    Math.max(...summaryCardHeights) - Math.min(...summaryCardHeights),
  ).toBeLessThanOrEqual(1);
  await expect(page.getByTestId("next-primary-card")).toBeVisible();
  await expect(page.getByTestId("next-problem-badge")).toBeVisible();
  await expect(page.getByTestId("next-problem-reason")).toBeVisible();
  expect(
    await page.getByTestId("next-alternative-card").count(),
  ).toBeLessThanOrEqual(3);
  expect(
    await page
      .locator(
        '[data-testid="next-alternative-card"], [data-testid="next-alternative-locked"]',
      )
      .count(),
  ).toBeLessThanOrEqual(3);
  await expect(page.getByTestId("next-selection-bar")).toBeVisible();
  await expect(page.getByTestId("next-start-cta")).toBeEnabled();
  await expect(
    page.getByTestId("next-primary-card").locator("button"),
  ).toHaveCount(0);

  const selectionBefore = await page
    .getByTestId("next-selection-bar")
    .innerText();
  const firstAlternative = page.getByTestId("next-alternative-card").first();
  if ((await firstAlternative.count()) > 0) {
    await firstAlternative.click();
    await expect(page).toHaveURL(/\/practice\/next/);
    await expect
      .poll(() => page.getByTestId("next-selection-bar").innerText())
      .not.toBe(selectionBefore);
  }

  expect(errors).toEqual([]);
});
