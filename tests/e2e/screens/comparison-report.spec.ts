import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
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
const createdSubmissionIds: string[] = [];
const createdReportIds: string[] = [];

const DIMENSION_ROWS = [
  ["grammar", 78, 68],
  ["vocab", 82, 77],
  ["structure", 74, 65],
  ["content", 86, 78],
  ["expression", 80, 70],
  ["topic_fit", 88, 83],
] as const;

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
    throw new Error("Missing Supabase service credentials for R-01 e2e setup");
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

async function createComparisonReportFixture() {
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

  const previousSubmissionId = randomUUID();
  const currentSubmissionId = randomUUID();
  const reportId = randomUUID();
  const previousAnswer =
    "The chart shows online learning increasing, but the explanation is short.";
  const currentAnswer = [
    "The chart shows that online learning increased steadily after 2022.",
    "This change suggests that students prefer flexible study options.",
    "Schools should support both online materials and classroom guidance.",
  ].join("\n");

  const submissions = await sb.from("writing_submissions").insert([
    {
      id: previousSubmissionId,
      user_id: user.id,
      problem_id: problem.data.id,
      question_no: 53,
      answer_text: previousAnswer,
      char_count: previousAnswer.length,
      feedback_status: "complete",
      submitted_at: new Date(Date.now() - 86_400_000).toISOString(),
    },
    {
      id: currentSubmissionId,
      user_id: user.id,
      problem_id: problem.data.id,
      question_no: 53,
      answer_text: currentAnswer,
      char_count: currentAnswer.length,
      feedback_status: "complete",
      parent_submission_id: previousSubmissionId,
      submitted_at: new Date().toISOString(),
    },
  ]);
  if (submissions.error) throw submissions.error;

  const feedback = await sb.from("writing_feedback").insert([
    {
      submission_id: previousSubmissionId,
      user_id: user.id,
      status: "complete",
      score_total: 68,
      score_max: 100,
      overall_summary:
        "The previous answer identified the trend but had limited support.",
      ai_model: "e2e-fixture",
      ai_model_version: "R-01",
    },
    {
      submission_id: currentSubmissionId,
      user_id: user.id,
      status: "complete",
      score_total: 82,
      score_max: 100,
      overall_summary:
        "The current answer has clearer structure and stronger support.",
      ai_model: "e2e-fixture",
      ai_model_version: "R-01",
    },
  ]);
  if (feedback.error) throw feedback.error;

  const dimensions = await sb.from("feedback_dimension_scores").insert(
    DIMENSION_ROWS.flatMap(([dimension, currentScore, previousScore]) => [
      {
        submission_id: previousSubmissionId,
        user_id: user.id,
        dimension,
        score: previousScore,
        score_max: 100,
        summary: `Previous ${dimension} baseline.`,
        weakness_level: 3,
      },
      {
        submission_id: currentSubmissionId,
        user_id: user.id,
        dimension,
        score: currentScore,
        score_max: 100,
        summary: `Current ${dimension} score.`,
        weakness_level: 2,
      },
    ]),
  );
  if (dimensions.error) throw dimensions.error;

  const report = await sb.from("comparison_reports").insert({
    id: reportId,
    user_id: user.id,
    current_submission_id: currentSubmissionId,
    previous_submission_id: previousSubmissionId,
    metrics: {
      score_delta: 14,
      dimension_deltas: Object.fromEntries(
        DIMENSION_ROWS.map(([dimension, currentScore, previousScore]) => [
          dimension,
          currentScore - previousScore,
        ]),
      ),
      char_delta: currentAnswer.length - previousAnswer.length,
      no_previous: false,
    },
    narrative:
      "Current answer improved by adding a clearer structure and more complete support. Grammar and expression also moved upward, so the next practice should focus on keeping evidence precise.",
    ai_model: "e2e-fixture",
  });
  if (report.error) throw report.error;

  createdSubmissionIds.push(previousSubmissionId, currentSubmissionId);
  createdReportIds.push(reportId);
  return { reportId, previousAnswer, currentAnswer };
}

test.afterAll(async () => {
  if (createdSubmissionIds.length === 0 && createdReportIds.length === 0) {
    return;
  }
  const label = (process.env.SUPABASE_ENV_LABEL || "").toLowerCase();
  if (label === "prod" || label === "production") return;
  const sb = serviceClient();
  for (const id of createdReportIds) {
    await sb.from("comparison_reports").delete().eq("id", id);
  }
  for (const id of createdSubmissionIds) {
    await sb.from("feedback_dimension_scores").delete().eq("submission_id", id);
    await sb.from("writing_feedback").delete().eq("submission_id", id);
    await sb.from("writing_submissions").delete().eq("id", id);
  }
});

test.describe("anonymous access", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("R-01 direct URL redirects anonymous users to login", async ({
    page,
  }) => {
    await page.goto(`/writing/reports/${randomUUID()}/compare`, {
      waitUntil: "networkidle",
    });

    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("authenticated comparison report", () => {
  test.skip(
    !SUPABASE_URL || !SERVICE_KEY,
    "R-01 e2e requires Supabase service credentials for an isolated report row",
  );

  test("R-01 comparison report matches the wireframe constraints", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    const { reportId, previousAnswer } = await createComparisonReportFixture();

    await page.goto(`/writing/reports/${reportId}/compare`, {
      waitUntil: "networkidle",
    });
    await expect(page).not.toHaveURL(/\/login/);

    const stickyHeader = page.getByTestId("comparison-page-header");
    await expect(stickyHeader).toBeVisible();
    await expect(
      page.locator(".app-notification-corner, .app-workspace-mobile-actions"),
    ).toHaveCount(0);
    mkdirSync("docs/qa/reports/2026-06-26-focus-page-global-actions", {
      recursive: true,
    });
    await page.screenshot({
      path: "docs/qa/reports/2026-06-26-focus-page-global-actions/R-01-comparison-report-e2e-after.png",
      fullPage: true,
    });
    await expect(stickyHeader).toHaveCSS("position", "sticky");
    await expect(stickyHeader).toHaveCSS("top", "0px");
    await expect(stickyHeader).toHaveCSS("border-bottom-width", "1px");
    await expect(stickyHeader).toHaveCSS("border-bottom-style", "solid");
    const headerTitle = stickyHeader.getByRole("heading", {
      name: "비교 리포트",
    });
    await expect(headerTitle).toHaveJSProperty("tagName", "H3");
    await expect(headerTitle).toHaveClass(/ant-typography/);
    await expect(headerTitle).toHaveClass(/!m-0/);
    await expect(headerTitle).toHaveClass(/text-2xl/);
    await expect(headerTitle).toHaveCSS("font-size", "28px");
    await expect(headerTitle).toHaveCSS("margin-bottom", "0px");
    const headerLearningActions = page
      .getByTestId("comparison-page-header")
      .locator(".app-page-header")
      .getByTestId("comparison-next-actions");
    await expect(headerLearningActions).toBeVisible();
    await expect(
      page
        .locator(".app-page-header__actions")
        .getByTestId("comparison-action-share"),
    ).toBeVisible();
    await expect
      .poll(async () =>
        page
          .locator(".app-page-header__actions button")
          .evaluateAll((buttons) =>
            buttons.map((button) => button.getAttribute("data-testid")),
          ),
      )
      .toEqual([
        "comparison-action-retry",
        "comparison-action-next",
        "comparison-action-weakness",
        "comparison-action-share",
      ]);
    expect(
      await page.getByTestId("comparison-kpi-item").count(),
    ).toBeLessThanOrEqual(5);
    await expect(page.getByTestId("comparison-kpi-block")).toContainText("14");
    await expect(page.getByTestId("comparison-chart")).toBeVisible();
    await expect(page.getByTestId("comparison-chart-view-table")).toBeVisible();
    await page.getByTestId("comparison-chart-view-table").click();
    await expect(page.getByTestId("comparison-chart-table")).toContainText(
      /이전|Previous|Trước/,
    );
    expect(
      await page.getByTestId("comparison-dimension-card").count(),
    ).toBeLessThanOrEqual(4);
    await expect(page.getByTestId("comparison-narrative")).toContainText(
      "Current answer improved",
    );
    await expect(page.getByTestId("comparison-submission-diff")).toContainText(
      previousAnswer,
    );
    await expect(page.getByTestId("comparison-action-weakness")).toBeEnabled();
    await expect(
      page.getByTestId("comparison-next-actions").locator("button"),
    ).toHaveCount(3);
    await expect(
      page
        .locator(".app-page-header ~ *")
        .getByTestId("comparison-next-actions"),
    ).toHaveCount(0);

    expect(errors).toEqual([]);
  });
});
