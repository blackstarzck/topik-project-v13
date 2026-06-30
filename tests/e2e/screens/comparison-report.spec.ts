import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
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

async function expectColorToMatchCssVar(locator: Locator, cssVarName: string) {
  const color = await locator.evaluate((element, name) => {
    const probe = document.createElement("span");
    probe.style.color = `var(${name})`;
    element.append(probe);
    const resolvedColor = getComputedStyle(probe).color;
    probe.remove();
    return resolvedColor;
  }, cssVarName);
  await expect(locator).toHaveCSS("color", color);
}

function serviceClient() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error("Missing Supabase service credentials for R-01 e2e setup");
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

function isProtectedSupabaseEnv() {
  const label = (process.env.SUPABASE_ENV_LABEL || "").toLowerCase();
  return label === "prod" || label === "production";
}

async function cleanupStaleComparisonFixtures(
  sb: ReturnType<typeof serviceClient>,
  userId: string,
) {
  if (isProtectedSupabaseEnv()) return;

  const feedback = await sb
    .from("writing_feedback")
    .select("submission_id")
    .eq("user_id", userId)
    .eq("ai_model", "e2e-fixture")
    .eq("ai_model_version", "R-01");
  if (feedback.error) throw feedback.error;

  const submissionIds = (feedback.data ?? [])
    .map((row) => row.submission_id)
    .filter((id): id is string => Boolean(id));

  const reports = await sb
    .from("comparison_reports")
    .select("id")
    .eq("user_id", userId)
    .eq("ai_model", "e2e-fixture");
  if (reports.error) throw reports.error;

  const reportIds = (reports.data ?? [])
    .map((row) => row.id)
    .filter((id): id is string => Boolean(id));

  if (reportIds.length > 0) {
    await sb.from("comparison_reports").delete().in("id", reportIds);
  }
  if (submissionIds.length > 0) {
    await sb
      .from("feedback_dimension_scores")
      .delete()
      .in("submission_id", submissionIds);
    await sb
      .from("writing_feedback")
      .delete()
      .in("submission_id", submissionIds);
    await sb.from("writing_submissions").delete().in("id", submissionIds);
  }
}

async function createComparisonReportFixture() {
  const sb = serviceClient();
  const users = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) throw users.error;
  const user = users.data.users.find(
    (candidate) => candidate.email?.toLowerCase() === EMAIL.toLowerCase(),
  );
  if (!user) throw new Error(`E2E student user not found: ${EMAIL}`);

  await cleanupStaleComparisonFixtures(sb, user.id);

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

  const firstSubmissionId = randomUUID();
  const selectedPreviousSubmissionId = randomUUID();
  const analyzingSubmissionId = randomUUID();
  const currentSubmissionId = randomUUID();
  const reportId = randomUUID();
  const firstAnswer =
    "The chart shows an increase, but the answer does not explain the reason.";
  const previousAnswer =
    "The chart shows online learning increasing, but the explanation is short.";
  const analyzingAnswer =
    "Online learning rose quickly. The analysis for this answer is still running.";
  const currentAnswer = [
    "The chart shows that online learning increased steadily after 2022.",
    "This change suggests that students prefer flexible study options.",
    "Schools should support both online materials and classroom guidance.",
  ].join("\n");

  const otherProblem = await sb
    .from("problems")
    .select("id, question_no")
    .eq("domain", "writing")
    .eq("publish_status", "published")
    .neq("id", problem.data.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (otherProblem.error) throw otherProblem.error;
  const otherProblemData = otherProblem.data;

  const otherSubmissionId = otherProblemData?.id ? randomUUID() : null;
  const otherAnswer =
    "This answer belongs to another problem and must not appear in the drawer.";
  const sameProblemSubmissions = [
    {
      id: firstSubmissionId,
      user_id: user.id,
      problem_id: problem.data.id,
      question_no: 53,
      answer_text: firstAnswer,
      char_count: firstAnswer.length,
      feedback_status: "complete",
      submitted_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    },
    {
      id: selectedPreviousSubmissionId,
      user_id: user.id,
      problem_id: problem.data.id,
      question_no: 53,
      answer_text: previousAnswer,
      char_count: previousAnswer.length,
      feedback_status: "complete",
      submitted_at: new Date(Date.now() - 86_400_000).toISOString(),
    },
    {
      id: analyzingSubmissionId,
      user_id: user.id,
      problem_id: problem.data.id,
      question_no: 53,
      answer_text: analyzingAnswer,
      char_count: analyzingAnswer.length,
      feedback_status: "analyzing",
      submitted_at: new Date(Date.now() - 43_200_000).toISOString(),
    },
    {
      id: currentSubmissionId,
      user_id: user.id,
      problem_id: problem.data.id,
      question_no: 53,
      answer_text: currentAnswer,
      char_count: currentAnswer.length,
      feedback_status: "complete",
      parent_submission_id: selectedPreviousSubmissionId,
      submitted_at: new Date().toISOString(),
    },
  ];
  const otherProblemSubmissions =
    otherSubmissionId && otherProblemData
      ? [
          {
            id: otherSubmissionId,
            user_id: user.id,
            problem_id: otherProblemData.id,
            question_no: otherProblemData.question_no ?? 54,
            answer_text: otherAnswer,
            char_count: otherAnswer.length,
            feedback_status: "complete",
            submitted_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
          },
        ]
      : [];
  const submissions = await sb
    .from("writing_submissions")
    .insert([...sameProblemSubmissions, ...otherProblemSubmissions]);
  if (submissions.error) throw submissions.error;
  createdSubmissionIds.push(
    firstSubmissionId,
    selectedPreviousSubmissionId,
    analyzingSubmissionId,
    currentSubmissionId,
  );
  if (otherSubmissionId) createdSubmissionIds.push(otherSubmissionId);

  const feedbackRows = [
    {
      submission_id: firstSubmissionId,
      user_id: user.id,
      status: "complete",
      score_total: 62,
      score_max: 100,
      overall_summary:
        "The first answer noticed the increase but did not explain it enough.",
      ai_model: "e2e-fixture",
      ai_model_version: "R-01",
    },
    {
      submission_id: selectedPreviousSubmissionId,
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
    ...(otherSubmissionId
      ? [
          {
            submission_id: otherSubmissionId,
            user_id: user.id,
            status: "complete",
            score_total: 76,
            score_max: 100,
            overall_summary:
              "This complete feedback belongs to another problem.",
            ai_model: "e2e-fixture",
            ai_model_version: "R-01",
          },
        ]
      : []),
  ];
  const feedback = await sb.from("writing_feedback").insert(feedbackRows);
  if (feedback.error) throw feedback.error;

  const dimensions = await sb.from("feedback_dimension_scores").insert(
    DIMENSION_ROWS.flatMap(([dimension, currentScore, previousScore]) => [
      {
        submission_id: firstSubmissionId,
        user_id: user.id,
        dimension,
        score: Math.max(previousScore - 6, 0),
        score_max: 100,
        summary: `First ${dimension} baseline.`,
        weakness_level: 4,
      },
      {
        submission_id: selectedPreviousSubmissionId,
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
    previous_submission_id: selectedPreviousSubmissionId,
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

  createdReportIds.push(reportId);
  return { reportId, previousAnswer, currentAnswer, firstSubmissionId };
}

async function createShortAnswerComparisonReportFixture() {
  const sb = serviceClient();
  const users = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) throw users.error;
  const user = users.data.users.find(
    (candidate) => candidate.email?.toLowerCase() === EMAIL.toLowerCase(),
  );
  if (!user) throw new Error(`E2E student user not found: ${EMAIL}`);

  await cleanupStaleComparisonFixtures(sb, user.id);

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

  const firstSubmissionId = randomUUID();
  const previousSubmissionId = randomUUID();
  const currentSubmissionId = randomUUID();
  const reportId = randomUUID();
  const firstAnswer = "ㄱ: 첫 답안\nㄴ: 첫 두 번째";
  const previousAnswer = "ㄱ: 이전 답안\nㄴ: 이전 두 번째";
  const currentAnswer = "ㄱ: 현재 답안\nㄴ: 현재 두 번째";

  const submissions = await sb.from("writing_submissions").insert([
    {
      id: firstSubmissionId,
      user_id: user.id,
      problem_id: problem.data.id,
      question_no: 51,
      answer_text: firstAnswer,
      answer_json: {
        _v: "51.v1",
        blanks: { ㄱ: "첫 답안", ㄴ: "첫 두 번째" },
      },
      char_count: 11,
      feedback_status: "complete",
      submitted_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    },
    {
      id: previousSubmissionId,
      user_id: user.id,
      problem_id: problem.data.id,
      question_no: 51,
      answer_text: previousAnswer,
      answer_json: {
        _v: "51.v1",
        blanks: { ㄱ: "이전 답안", ㄴ: "이전 두 번째" },
      },
      char_count: 12,
      feedback_status: "complete",
      submitted_at: new Date(Date.now() - 86_400_000).toISOString(),
    },
    {
      id: currentSubmissionId,
      user_id: user.id,
      problem_id: problem.data.id,
      question_no: 51,
      answer_text: currentAnswer,
      answer_json: {
        _v: "51.v1",
        blanks: { ㄱ: "현재 답안", ㄴ: "현재 두 번째" },
      },
      char_count: 14,
      feedback_status: "complete",
      parent_submission_id: previousSubmissionId,
      submitted_at: new Date().toISOString(),
    },
  ]);
  if (submissions.error) throw submissions.error;
  createdSubmissionIds.push(
    firstSubmissionId,
    previousSubmissionId,
    currentSubmissionId,
  );

  const feedback = await sb.from("writing_feedback").insert([
    {
      submission_id: firstSubmissionId,
      user_id: user.id,
      status: "complete",
      score_total: 1,
      score_max: 10,
      overall_summary: "First short answer feedback.",
      raw_ai_result: {
        trait_scores: [
          {
            trait: "blank_1",
            score: 1,
            max_score: 5,
            feedback: "First blank needs more context.",
            strengths: [],
            improvements: ["Add clearer context."],
          },
          {
            trait: "blank_2",
            score: 1,
            max_score: 5,
            feedback: "Second blank needs a natural ending.",
            strengths: [],
            improvements: ["Make the ending more natural."],
          },
        ],
      },
      ai_model: "e2e-fixture",
      ai_model_version: "R-01-q51",
    },
    {
      submission_id: previousSubmissionId,
      user_id: user.id,
      status: "complete",
      score_total: 2,
      score_max: 10,
      overall_summary: "Previous short answer feedback.",
      raw_ai_result: {
        trait_scores: [
          {
            trait: "blank_1",
            score: 2,
            max_score: 5,
            feedback: "문맥 정보가 부족했습니다.",
            strengths: [],
            improvements: ["핵심 정보를 더 분명히 쓰세요."],
          },
          {
            trait: "blank_2",
            score: 2,
            max_score: 5,
            feedback: "요청 표현이 약했습니다.",
            strengths: [],
            improvements: ["종결 표현을 더 자연스럽게 쓰세요."],
          },
        ],
      },
      ai_model: "e2e-fixture",
      ai_model_version: "R-01-q51",
    },
    {
      submission_id: currentSubmissionId,
      user_id: user.id,
      status: "complete",
      score_total: 4,
      score_max: 10,
      overall_summary: "Current short answer feedback.",
      raw_ai_result: {
        trait_scores: [
          {
            trait: "blank_1",
            score: 4,
            max_score: 5,
            feedback: "문맥에 맞게 보완했습니다.",
            strengths: ["핵심 의미가 분명합니다."],
            improvements: ["높임 표현을 더 자연스럽게 다듬어 보세요."],
          },
          {
            trait: "blank_2",
            score: 3,
            max_score: 5,
            feedback: "요청 의도가 더 분명해졌습니다.",
            strengths: ["요청 표현이 포함되었습니다."],
            improvements: ["문장 끝 연결을 더 매끄럽게 다듬어 보세요."],
          },
        ],
      },
      ai_model: "e2e-fixture",
      ai_model_version: "R-01-q51",
    },
  ]);
  if (feedback.error) throw feedback.error;

  const report = await sb.from("comparison_reports").insert({
    id: reportId,
    user_id: user.id,
    current_submission_id: currentSubmissionId,
    previous_submission_id: previousSubmissionId,
    metrics: {
      score_delta: 20,
      dimension_deltas: { blank_1: 40, blank_2: 20 },
      char_delta: 2,
      no_previous: false,
    },
    narrative:
      "이번 답안의 총점이 20점 향상되었습니다. 주요 변화: ㄱ 빈칸 +40점, ㄴ 빈칸 +20점.",
    ai_model: "e2e-fixture",
  });
  if (report.error) throw report.error;

  createdReportIds.push(reportId);
  return { reportId, previousAnswer, currentAnswer, previousSubmissionId };
}

async function cleanupCreatedRows() {
  if (createdSubmissionIds.length === 0 && createdReportIds.length === 0) {
    return;
  }
  if (isProtectedSupabaseEnv()) return;
  const sb = serviceClient();
  const reportIds = [...createdReportIds];
  const submissionIds = [...createdSubmissionIds];
  createdReportIds.length = 0;
  createdSubmissionIds.length = 0;

  for (const id of reportIds) {
    await sb.from("comparison_reports").delete().eq("id", id);
  }
  for (const id of submissionIds) {
    await sb.from("feedback_dimension_scores").delete().eq("submission_id", id);
    await sb.from("writing_feedback").delete().eq("submission_id", id);
    await sb.from("writing_submissions").delete().eq("id", id);
  }
}

test.afterEach(async () => {
  await cleanupCreatedRows();
});

test.afterAll(async () => {
  await cleanupCreatedRows();
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
    const { reportId, previousAnswer, currentAnswer, firstSubmissionId } =
      await createComparisonReportFixture();

    await page.goto(`/writing/reports/${reportId}/compare`, {
      waitUntil: "networkidle",
    });
    await expect(page).not.toHaveURL(/\/login/);

    const stickyHeader = page.getByTestId("comparison-page-header");
    await expect(stickyHeader).toBeVisible();
    await expect(
      page.locator(".app-notification-corner, .app-workspace-mobile-actions"),
    ).toHaveCount(0);
    await expect(page.locator(".app-workspace-sider")).toHaveCount(0);
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
      name: "53번 비교 리포트",
    });
    await expect(headerTitle).toHaveJSProperty("tagName", "H3");
    await expect(headerTitle).toHaveClass(/ant-typography/);
    await expect(headerTitle).toHaveClass(/!m-0/);
    await expect(headerTitle).toHaveClass(/text-2xl/);
    await expect(headerTitle).toHaveCSS("font-size", "28px");
    await expect(headerTitle).toHaveCSS("margin-bottom", "0px");
    const headerQuestionNo = stickyHeader.getByTestId(
      "comparison-title-question-no",
    );
    await expect(headerQuestionNo).toHaveText("53");
    await expect(headerQuestionNo).toHaveCSS(
      "background-image",
      /neon-orange\.png/,
    );
    const headerLearningActions = page
      .getByTestId("comparison-page-header")
      .getByTestId("comparison-next-actions");
    await expect(headerLearningActions).toBeVisible();
    await expect(
      page.getByTestId("comparison-page-header").locator(".app-page-header"),
    ).toHaveCount(0);
    await expect(
      page
        .getByTestId("report-page-header-actions")
        .getByTestId("comparison-action-share"),
    ).toBeVisible();
    await expect
      .poll(async () =>
        page
          .getByTestId("report-page-header-actions")
          .locator("button")
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
    await expect(page.getByTestId("comparison-summary-strip")).toBeVisible();
    await expect(
      page
        .getByTestId("comparison-summary-strip")
        .getByTestId("comparison-action-change-target"),
    ).toBeVisible();
    await expect(page.getByTestId("comparison-kpi-block")).toHaveCount(0);
    await expect(page.getByTestId("comparison-kpi-item")).toHaveCount(0);
    await expect(page.getByTestId("comparison-chart")).toBeVisible();
    await expect(page.getByTestId("comparison-chart-view-table")).toHaveCount(
      0,
    );
    await expect(page.getByTestId("comparison-chart-view-chart")).toHaveCount(
      0,
    );
    await expect(page.getByTestId("comparison-chart-table")).toHaveCount(0);
    expect(
      await page.getByTestId("comparison-dimension-card").count(),
    ).toBeLessThanOrEqual(4);
    const dimensionLabels = await page
      .getByTestId("comparison-dimension-label")
      .all();
    for (const label of dimensionLabels) {
      await expectColorToMatchCssVar(label, "--ant-color-text-description");
    }
    const submissionTable = page.getByTestId("comparison-submission-table");
    for (const heading of ["이번 답안", "이전 답안", "서론", "본론", "결론"]) {
      await expectColorToMatchCssVar(
        submissionTable.getByText(heading, { exact: true }),
        "--ant-color-text-description",
      );
    }
    await expect(page.getByTestId("comparison-narrative")).toContainText(
      "Current answer improved",
    );
    await expect(page.getByTestId("comparison-submission-diff")).toContainText(
      previousAnswer,
    );
    await expect(page.getByTestId("comparison-submission-diff")).toContainText(
      currentAnswer.split("\n")[0],
    );
    await expect(page.getByTestId("comparison-action-weakness")).toBeEnabled();
    await expect(
      page.getByTestId("comparison-next-actions").locator("button"),
    ).toHaveCount(4);
    await expect(
      page
        .getByTestId("comparison-page-body")
        .getByTestId("comparison-next-actions"),
    ).toHaveCount(0);

    await page.getByTestId("comparison-action-change-target").click();
    await expect(
      page
        .getByTestId("comparison-page-shell")
        .locator(".comparison-target-drawer"),
    ).toBeVisible();
    const targetDrawerRoot = page.locator(".comparison-target-drawer");
    await expect(targetDrawerRoot).toHaveCSS("position", "fixed");
    await expect(targetDrawerRoot).toHaveCSS("top", "0px");
    await expect(targetDrawerRoot).toHaveCSS("right", "0px");
    await expect(targetDrawerRoot).toHaveCSS("bottom", "0px");
    await expect(targetDrawerRoot).toHaveCSS("left", "0px");
    await page.screenshot({
      path: "docs/qa/reports/2026-06-26-focus-page-global-actions/R-01-comparison-report-drawer-open.png",
      fullPage: true,
    });
    await expect(
      page.locator(`[data-submission-id="${firstSubmissionId}"]`),
    ).toBeVisible();
    await expect
      .poll(async () => page.getByTestId("comparison-target-option").count())
      .toBeGreaterThanOrEqual(2);
    const firstTargetOption = page
      .getByTestId("comparison-target-option")
      .first();
    const firstTargetScore = page
      .getByTestId("comparison-target-option-score")
      .first();
    const firstTargetOptionRect = await firstTargetOption.boundingBox();
    const firstTargetScoreRect = await firstTargetScore.boundingBox();
    expect(firstTargetOptionRect).not.toBeNull();
    expect(firstTargetScoreRect).not.toBeNull();
    expect(
      Math.abs(
        (firstTargetScoreRect?.y ?? 0) +
          (firstTargetScoreRect?.height ?? 0) / 2 -
          ((firstTargetOptionRect?.y ?? 0) +
            (firstTargetOptionRect?.height ?? 0) / 2),
      ),
    ).toBeLessThan(2);
    const targetDrawerBody = page.getByTestId("comparison-target-drawer-body");
    const targetDrawerFooter = page.getByTestId(
      "comparison-target-drawer-footer",
    );
    const targetDrawerFooterShell = page.locator(
      ".comparison-target-drawer .ant-drawer-footer",
    );
    const targetDrawerWrapper = page.locator(
      ".comparison-target-drawer .ant-drawer-content-wrapper",
    );
    const targetDrawerSection = page.locator(
      ".comparison-target-drawer .ant-drawer-section",
    );
    const targetListScroll = page.getByTestId("comparison-target-list-scroll");
    const viewportHeight = page.viewportSize()?.height;
    await expect(targetDrawerSection).toHaveCSS("overflow-y", "hidden");
    const wrapperRect = await targetDrawerWrapper.boundingBox();
    const sectionRect = await targetDrawerSection.boundingBox();
    expect(wrapperRect).not.toBeNull();
    expect(sectionRect).not.toBeNull();
    if (viewportHeight !== undefined) {
      expect(
        Math.abs((wrapperRect?.height ?? 0) - viewportHeight),
      ).toBeLessThan(1);
      expect(
        Math.abs((sectionRect?.height ?? 0) - viewportHeight),
      ).toBeLessThan(1);
    }
    await expect(targetDrawerBody).toHaveCSS("overflow-y", "hidden");
    await expect(targetListScroll).toHaveCSS("overflow-y", "auto");
    await expect(targetDrawerFooterShell).toHaveCSS("position", "sticky");
    await expect(targetDrawerFooterShell).toHaveCSS("bottom", "0px");
    const footerRectBeforeScroll = await targetDrawerFooter.boundingBox();
    await targetListScroll.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    const footerRectAfterScroll = await targetDrawerFooter.boundingBox();
    expect(footerRectBeforeScroll).not.toBeNull();
    expect(footerRectAfterScroll).not.toBeNull();
    if (viewportHeight !== undefined) {
      expect(
        (footerRectBeforeScroll?.y ?? 0) +
          (footerRectBeforeScroll?.height ?? 0),
      ).toBeLessThanOrEqual(viewportHeight + 1);
    }
    expect(
      Math.abs(
        (footerRectAfterScroll?.y ?? 0) - (footerRectBeforeScroll?.y ?? 0),
      ),
    ).toBeLessThan(1);
    await expect(
      page.getByTestId("comparison-target-drawer-body"),
    ).not.toContainText("76점");
    await expect(
      page.getByTestId("comparison-target-drawer-body"),
    ).not.toContainText("직전 완료 답안");
    await expect(
      page.getByTestId("comparison-target-drawer-body"),
    ).not.toContainText("추천");
    await expect(
      page.getByTestId("comparison-target-drawer-body"),
    ).not.toContainText("이전 완료");
    await expect(
      page.getByTestId("comparison-target-drawer-body"),
    ).not.toContainText("자");
    await expect(
      page.getByTestId("comparison-target-drawer-body"),
    ).not.toContainText("같은 문제만");
    await expect(page.getByTestId("comparison-target-confirm")).toBeDisabled();
    await expect(
      page.getByTestId("comparison-target-status-filter"),
    ).toHaveCount(0);
    await expect(page.getByTestId("comparison-target-date-sort")).toBeVisible();
    await expect(
      page.getByTestId("comparison-target-score-sort"),
    ).toBeVisible();
    const analyzingCandidate = page.locator(
      '[data-testid="comparison-target-option"][data-feedback-status="analyzing"]',
    );
    await expect(analyzingCandidate).toHaveCount(0);
    await page.screenshot({
      path: "docs/qa/reports/2026-06-26-focus-page-global-actions/R-01-comparison-report-drawer-analysis-states.png",
      fullPage: true,
    });

    await page.evaluate(() => {
      (
        window as typeof window & {
          __comparisonNoReloadMarker?: string;
        }
      ).__comparisonNoReloadMarker = "kept";
    });
    await page.locator(`[data-submission-id="${firstSubmissionId}"]`).click();
    await expect(page.getByTestId("comparison-target-confirm")).toBeEnabled();
    const originalReportUrl = page.url();
    await page.getByTestId("comparison-target-confirm").click();
    await expect
      .poll(() => page.url(), { timeout: 10000 })
      .not.toBe(originalReportUrl);
    await expect(page).toHaveURL(/\/writing\/reports\/[^/]+\/compare/);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (
              window as typeof window & {
                __comparisonNoReloadMarker?: string;
              }
            ).__comparisonNoReloadMarker ?? null,
        ),
      )
      .toBe("kept");
    const newReportId = page
      .url()
      .match(/\/writing\/reports\/([^/]+)\/compare/)?.[1];
    if (newReportId && newReportId !== reportId) {
      createdReportIds.push(newReportId);
    }
    const newReportUrl = page.url();
    await expect(page.getByTestId("comparison-summary-strip")).toContainText(
      "62",
    );
    const successNotification = page
      .locator(".ant-notification-notice.app-global-notification")
      .filter({ hasText: "비교 리포트를 갱신했어요" })
      .first();
    await expect(successNotification).toBeVisible();
    const successNotificationBox = await successNotification.boundingBox();
    expect(successNotificationBox?.width ?? 0).toBeLessThanOrEqual(360);
    expect(successNotificationBox?.width ?? 0).toBeGreaterThanOrEqual(
      Math.min(300, (page.viewportSize()?.width ?? 360) - 64),
    );
    expect(successNotificationBox?.x ?? 0).toBeGreaterThanOrEqual(0);
    expect(
      (successNotificationBox?.x ?? 0) + (successNotificationBox?.width ?? 0),
    ).toBeLessThanOrEqual((page.viewportSize()?.width ?? 360) + 1);
    expect(successNotificationBox?.y ?? 0).toBeGreaterThanOrEqual(80);
    await page.reload({ waitUntil: "networkidle" });
    await expect(page).toHaveURL(newReportUrl);
    await expect(page.getByTestId("comparison-summary-strip")).toContainText(
      "62",
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    await page.mouse.move(20, 20);
    await page.screenshot({
      path: "docs/qa/reports/2026-06-26-focus-page-global-actions/R-01-comparison-report-after-target-change.png",
      fullPage: true,
    });

    expect(errors).toEqual([]);
  });

  test("R-01 comparison target drawer stays fixed to the viewport", async ({
    page,
  }) => {
    const { reportId } = await createComparisonReportFixture();

    await page.goto(`/writing/reports/${reportId}/compare`, {
      waitUntil: "networkidle",
    });

    await expect(page).not.toHaveURL(/\/login/);
    const changeTargetButton = page.getByTestId(
      "comparison-action-change-target",
    );
    await expect(changeTargetButton).toBeVisible();
    await changeTargetButton.click();
    const targetDrawerRoot = page.locator(".comparison-target-drawer");
    await expect(targetDrawerRoot).toBeVisible();
    await expect(targetDrawerRoot).toHaveCSS("position", "fixed");
    await expect(targetDrawerRoot).toHaveCSS("top", "0px");
    await expect(targetDrawerRoot).toHaveCSS("right", "0px");
    await expect(targetDrawerRoot).toHaveCSS("bottom", "0px");
    await expect(targetDrawerRoot).toHaveCSS("left", "0px");
    const targetDrawerWrapper = page.locator(
      ".comparison-target-drawer .ant-drawer-content-wrapper",
    );
    const targetDrawerSection = page.locator(
      ".comparison-target-drawer .ant-drawer-section",
    );
    const targetDrawerBody = page.getByTestId("comparison-target-drawer-body");
    const targetDrawerFooter = page.getByTestId(
      "comparison-target-drawer-footer",
    );
    const targetDrawerFooterShell = page.locator(
      ".comparison-target-drawer .ant-drawer-footer",
    );
    const targetListScroll = page.getByTestId("comparison-target-list-scroll");
    const viewportHeight = page.viewportSize()?.height;
    await expect(targetDrawerSection).toHaveCSS("overflow-y", "hidden");
    const wrapperRect = await targetDrawerWrapper.boundingBox();
    const sectionRect = await targetDrawerSection.boundingBox();
    const footerRectBeforeScroll = await targetDrawerFooter.boundingBox();
    expect(wrapperRect).not.toBeNull();
    expect(sectionRect).not.toBeNull();
    expect(footerRectBeforeScroll).not.toBeNull();
    if (viewportHeight !== undefined) {
      expect(
        Math.abs((wrapperRect?.height ?? 0) - viewportHeight),
      ).toBeLessThan(1);
      expect(
        Math.abs((sectionRect?.height ?? 0) - viewportHeight),
      ).toBeLessThan(1);
      expect(
        (footerRectBeforeScroll?.y ?? 0) +
          (footerRectBeforeScroll?.height ?? 0),
      ).toBeLessThanOrEqual(viewportHeight + 1);
    }
    await expect(targetDrawerBody).toHaveCSS("overflow-y", "hidden");
    await expect(targetListScroll).toHaveCSS("overflow-y", "auto");
    await expect(targetDrawerFooterShell).toHaveCSS("position", "sticky");
    await expect(targetDrawerFooterShell).toHaveCSS("bottom", "0px");
    await expect(
      page.getByTestId("comparison-target-status-filter"),
    ).toHaveCount(0);
    await targetListScroll.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    const footerRectAfterScroll = await targetDrawerFooter.boundingBox();
    expect(footerRectAfterScroll).not.toBeNull();
    expect(
      Math.abs(
        (footerRectAfterScroll?.y ?? 0) - (footerRectBeforeScroll?.y ?? 0),
      ),
    ).toBeLessThan(1);
  });

  test("R-01 score comparison chart omits the duplicate table fallback", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    const { reportId } = await createComparisonReportFixture();

    await page.goto(`/writing/reports/${reportId}/compare`, {
      waitUntil: "networkidle",
    });

    await expect(page.getByTestId("comparison-chart")).toBeVisible();
    await expect(page.getByTestId("comparison-chart-view-table")).toHaveCount(
      0,
    );
    await expect(page.getByTestId("comparison-chart-view-chart")).toHaveCount(
      0,
    );
    await expect(page.getByTestId("comparison-chart-table")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "항목별 점수 (표)" }),
    ).toHaveCount(0);

    expect(errors).toEqual([]);
  });

  test("R-01 Q51 comparison report renders blank-level feedback", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    const { reportId, previousSubmissionId } =
      await createShortAnswerComparisonReportFixture();

    await page.goto(`/writing/reports/${reportId}/compare`, {
      waitUntil: "networkidle",
    });

    await expect(page.getByTestId("comparison-page-header")).toBeVisible();
    const headerQuestionNo = page.getByTestId("comparison-title-question-no");
    await expect(headerQuestionNo).toHaveText("51");
    await expect(headerQuestionNo).toHaveCSS(
      "background-image",
      /neon-yellow\.png/,
    );
    await expect(
      page.getByTestId("comparison-summary-label").first(),
    ).toHaveCSS("font-size", "16px");
    await expect(
      page.getByTestId("comparison-summary-score").first(),
    ).toHaveCSS("font-size", "46px");
    await expect(
      page.getByTestId("comparison-summary-submitted-at").first(),
    ).toHaveCSS("font-size", "14px");
    await expect(page.getByTestId("comparison-summary-action-row")).toHaveCount(
      0,
    );
    const compareSummaryCard = page
      .getByTestId("comparison-summary-answer-card")
      .nth(1);
    const changeTargetButton = compareSummaryCard.getByTestId(
      "comparison-action-change-target",
    );
    await expect(changeTargetButton).toBeVisible();
    await expect(changeTargetButton).toHaveAttribute(
      "aria-label",
      "이전 답안 변경",
    );
    await expect(changeTargetButton).not.toContainText("이전 답안 변경");
    await expect(changeTargetButton.locator("svg")).toHaveAttribute(
      "width",
      "16",
    );
    await expect(changeTargetButton.locator("svg")).toHaveAttribute(
      "height",
      "16",
    );
    await expect(
      compareSummaryCard
        .getByTestId("comparison-summary-score-row")
        .getByTestId("comparison-action-change-target"),
    ).toBeVisible();
    const narrativeSummaryRow = page.getByTestId(
      "comparison-narrative-summary-row",
    );
    const narrativeSummaryGroup = narrativeSummaryRow.getByTestId(
      "comparison-narrative-summary-group",
    );
    await expect(
      narrativeSummaryRow.getByTestId("comparison-narrative-summary-icon"),
    ).toBeVisible();
    await expect(narrativeSummaryGroup).toBeVisible();
    await expect(
      narrativeSummaryGroup.getByTestId("comparison-narrative-summary"),
    ).toBeVisible();
    await expect(
      narrativeSummaryGroup.getByTestId("comparison-narrative-summary"),
    ).toHaveCSS("font-size", "20px");
    await expect(
      narrativeSummaryGroup.getByTestId("comparison-narrative-summary"),
    ).toHaveCSS("margin-bottom", "10px");
    await expect(
      narrativeSummaryGroup.getByTestId("comparison-narrative-disclaimer"),
    ).toBeVisible();
    await expect(
      page.getByTestId("comparison-blank-trait-panel"),
    ).toBeVisible();
    await expect(
      page.getByTestId("comparison-blank-trait-panel"),
    ).toContainText("빈칸별 점수 비교");
    await expect(
      page.getByTestId("comparison-blank-trait-panel"),
    ).toContainText("ㄱ 빈칸");
    await expect(
      page.getByTestId("comparison-blank-trait-panel"),
    ).toContainText("4/5점");
    await expect(
      page.getByTestId("comparison-blank-trait-panel"),
    ).toContainText("현재 답안");
    await expect(
      page.getByTestId("comparison-blank-section-header").locator(".ant-tag"),
    ).toHaveCount(0);
    await expect(page.getByTestId("comparison-blank-trait-delta")).toHaveCount(
      0,
    );
    await expect(page.getByTestId("comparison-chart")).toHaveCount(0);
    await expect(page.getByTestId("comparison-dimension-cards")).toHaveCount(0);
    await expect(page.getByTestId("comparison-submission-diff")).toHaveCount(0);

    await page.getByTestId("comparison-action-change-target").click();
    await expect(
      page.getByTestId("comparison-target-option").first(),
    ).toBeVisible();
    await expect(
      page.locator(`[data-submission-id="${previousSubmissionId}"]`),
    ).toBeVisible();
    await expect(
      page.getByTestId("comparison-target-same-problem"),
    ).toHaveCount(0);
    await expect(
      page.getByTestId("comparison-target-drawer-body"),
    ).not.toContainText("같은 문제만");
    await page.screenshot({
      path: "test-results/comparison-q51-blank-feedback.png",
      fullPage: true,
    });

    expect(errors).toEqual([]);
  });
});
