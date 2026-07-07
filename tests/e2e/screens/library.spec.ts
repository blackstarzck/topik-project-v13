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
    // CI without .env.local skips through the explicit env guard below.
  }
}

loadEnvLocal();

const EMAIL = process.env.E2E_STUDENT_EMAIL ?? "student@audit.local";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
const createdLibraryItemIds: string[] = [];
const createdSubmissionIds: string[] = [];
const createdStudyEventIds: string[] = [];

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 500) {
      errors.push(`response: ${response.status()} ${response.url()}`);
    }
  });
  return errors;
}

function serviceClient() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error("Missing Supabase service credentials for F-01 e2e setup");
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

async function createLibraryDashboardFixture() {
  const sb = serviceClient();
  const users = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) throw users.error;
  const user = users.data.users.find(
    (candidate) => candidate.email?.toLowerCase() === EMAIL.toLowerCase(),
  );
  if (!user) throw new Error(`E2E student user not found: ${EMAIL}`);

  const problem = await sb
    .from("problems")
    .select("id, title, question_no")
    .eq("domain", "writing")
    .eq("publish_status", "published")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (problem.error) throw problem.error;
  if (!problem.data?.id) throw new Error("No published writing problem found");

  const problemId = problem.data.id;
  const problemTitle = problem.data.title;
  const marker = `f01-dashboard-${randomUUID().slice(0, 8)}`;
  const questionNo = problem.data.question_no ?? 53;
  const completeSubmissionIds = Array.from({ length: 12 }, () => randomUUID());
  const analyzingSubmissionId = randomUUID();
  const failedSubmissionId = randomUUID();
  const completeLibraryIds = completeSubmissionIds.map(() => randomUUID());
  const waitingLibraryIds = [randomUUID(), randomUUID()];
  const savedProblemLibraryId = randomUUID();
  const libraryIds = [
    ...completeLibraryIds,
    ...waitingLibraryIds,
    savedProblemLibraryId,
  ];
  const studyEventIds = [randomUUID(), randomUUID()];
  const now = Date.now();
  const completeRows = completeSubmissionIds.map((id, index) => {
    const answerText =
      questionNo >= 53
        ? `${marker}-${index} `.repeat(questionNo === 54 ? 75 : 32).trim()
        : `${marker} short answer ${index}`;
    return {
      id,
      user_id: user.id,
      problem_id: problemId,
      question_no: questionNo,
      answer_text: answerText,
      char_count: answerText.length,
      feedback_status: "complete",
      submitted_at: new Date(now - (60_000 + index * 30_000)).toISOString(),
    };
  });
  const analyzingText = `${marker} analyzing`;
  const failedText = `${marker} failed`;

  const submissions = await sb.from("writing_submissions").insert([
    ...completeRows,
    {
      id: analyzingSubmissionId,
      user_id: user.id,
      problem_id: problemId,
      question_no: questionNo,
      answer_text: analyzingText,
      char_count: analyzingText.length,
      feedback_status: "analyzing",
      submitted_at: new Date(now - 30_000).toISOString(),
    },
    {
      id: failedSubmissionId,
      user_id: user.id,
      problem_id: problemId,
      question_no: questionNo,
      answer_text: failedText,
      char_count: failedText.length,
      feedback_status: "failed",
      submitted_at: new Date(now - 15_000).toISOString(),
    },
  ]);
  if (submissions.error) throw submissions.error;

  const feedback = await sb.from("writing_feedback").insert([
    ...completeSubmissionIds.map((submissionId, index) => ({
      submission_id: submissionId,
      user_id: user.id,
      status: "complete",
      score_total: 76 - (index % 4),
      score_max: 100,
      overall_summary: "F-01 dashboard fixture feedback summary.",
      ai_model: "e2e-fixture",
      ai_model_version: "F-01-dashboard",
      generated_at: new Date(now).toISOString(),
    })),
    {
      submission_id: failedSubmissionId,
      user_id: user.id,
      status: "failed",
      score_total: null,
      score_max: 100,
      overall_summary: "F-01 dashboard fixture failed feedback.",
      ai_model: "e2e-fixture",
      ai_model_version: "F-01-dashboard",
      generated_at: new Date(now).toISOString(),
    },
  ]);
  if (feedback.error) throw feedback.error;

  const dimensions = await sb.from("feedback_dimension_scores").insert([
    {
      submission_id: completeSubmissionIds[0],
      user_id: user.id,
      dimension: "structure",
      score: 62,
      score_max: 100,
      summary: "Structure is the lowest dashboard fixture dimension.",
      weakness_level: 5,
    },
    {
      submission_id: completeSubmissionIds[0],
      user_id: user.id,
      dimension: "language",
      score: 7,
      score_max: 10,
      summary: "Language uses a different max score.",
      weakness_level: 4,
    },
    {
      submission_id: completeSubmissionIds[0],
      user_id: user.id,
      dimension: "topic_fit",
      score: 34,
      score_max: 50,
      summary: "Topic fit is normalized in the dashboard.",
      weakness_level: 3,
    },
  ]);
  if (dimensions.error) throw dimensions.error;

  const library = await sb.from("library_items").insert([
    ...completeSubmissionIds.map((submissionId, index) => ({
      id: completeLibraryIds[index],
      user_id: user.id,
      item_type: "submission",
      submission_id: submissionId,
      tags: [marker],
      saved_at: new Date(now - (60_000 + index * 30_000)).toISOString(),
    })),
    {
      id: waitingLibraryIds[0],
      user_id: user.id,
      item_type: "submission",
      submission_id: analyzingSubmissionId,
      tags: [marker],
      saved_at: new Date(now - 30_000).toISOString(),
    },
    {
      id: waitingLibraryIds[1],
      user_id: user.id,
      item_type: "submission",
      submission_id: failedSubmissionId,
      tags: [marker],
      saved_at: new Date(now - 15_000).toISOString(),
    },
    {
      id: savedProblemLibraryId,
      user_id: user.id,
      item_type: "problem",
      problem_id: problemId,
      tags: [marker],
      saved_at: new Date(now - 45_000).toISOString(),
    },
  ]);
  if (library.error) throw library.error;

  const events = await sb.from("study_events").insert([
    {
      id: studyEventIds[0],
      user_id: user.id,
      event_type: "submission_submitted",
      occurred_at: new Date(now - 10_000).toISOString(),
      problem_id: problemId,
      submission_id: completeSubmissionIds[0],
      payload: { source: marker },
    },
    {
      id: studyEventIds[1],
      user_id: user.id,
      event_type: "feedback_viewed",
      occurred_at: new Date(now - 5_000).toISOString(),
      problem_id: problemId,
      submission_id: completeSubmissionIds[0],
      payload: { source: marker },
    },
  ]);
  if (events.error) throw events.error;

  createdLibraryItemIds.push(...libraryIds);
  createdSubmissionIds.push(
    ...completeSubmissionIds,
    analyzingSubmissionId,
    failedSubmissionId,
  );
  createdStudyEventIds.push(...studyEventIds);

  return {
    marker,
    questionNo,
    problemTitle: problemTitle ?? `${questionNo}번 문제`,
  };
}

async function cleanupLibraryFixtures() {
  if (
    createdLibraryItemIds.length === 0 &&
    createdSubmissionIds.length === 0 &&
    createdStudyEventIds.length === 0
  ) {
    return;
  }
  const label = (process.env.SUPABASE_ENV_LABEL || "").toLowerCase();
  if (label === "prod" || label === "production") return;
  const sb = serviceClient();
  for (const id of createdLibraryItemIds) {
    await sb.from("library_items").delete().eq("id", id);
  }
  for (const id of createdStudyEventIds) {
    await sb.from("study_events").delete().eq("id", id);
  }
  for (const id of createdSubmissionIds) {
    await sb.from("feedback_dimension_scores").delete().eq("submission_id", id);
    await sb.from("writing_feedback").delete().eq("submission_id", id);
    await sb.from("writing_submissions").delete().eq("id", id);
  }
  createdLibraryItemIds.length = 0;
  createdSubmissionIds.length = 0;
  createdStudyEventIds.length = 0;
}

test.afterEach(cleanupLibraryFixtures);
test.afterAll(cleanupLibraryFixtures);

test.skip(
  !SUPABASE_URL || !SERVICE_KEY,
  "F-01 dashboard e2e requires Supabase service credentials for isolated rows",
);

test("F-01 library dashboard renders study action sections", async ({
  page,
}) => {
  const errors = collectErrors(page);
  const fixture = await createLibraryDashboardFixture();

  await page.goto("/library", { waitUntil: "load" });
  await expect(page).not.toHaveURL(/\/login/);

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByTestId("library-dashboard")).toBeVisible();
  await expect(page.getByTestId("library-kpi-strip")).toBeVisible();
  await expect(page.getByTestId("library-kpi-card")).toHaveCount(4);
  await expect(page.getByText("복습 가능").first()).toBeVisible();
  await expect(page.getByText("비교 가능").first()).toBeVisible();
  await expect(page.getByTestId("library-tabs")).toHaveCount(0);
  await expect(page.getByTestId("library-type-filter")).toHaveCount(0);
  await expect(page.getByTestId("library-search")).toHaveCount(0);

  await expect(page.getByTestId("library-review-swiper")).toBeVisible();
  await expect(page.locator(".library-review-swiper-pagination")).toHaveCount(
    0,
  );
  await expect(page.getByText(fixture.problemTitle).first()).toBeVisible();
  await expect(
    page.getByRole("link", { name: "피드백 보기" }).first(),
  ).toHaveAttribute("href", /\/writing\/feedback\/(short|long)\//);
  await expect(
    page.getByRole("link", { name: /다시 풀기/ }).first(),
  ).toHaveAttribute("href", /fresh=1/);

  await page.getByRole("button", { name: "다음 복습 후보" }).click();
  await page.getByRole("button", { name: "이전 복습 후보" }).click();

  await expect(page.getByTestId("library-review-view-all")).toHaveAttribute(
    "href",
    "/library/problems",
  );
  await page.getByTestId("library-review-view-all").click();
  await expect(page).toHaveURL(/\/library\/problems$/);
  await expect(page.getByTestId("library-problems-back-link")).toHaveAttribute(
    "href",
    "/library",
  );
  await expect(page.getByTestId("library-problems-back-link")).not.toHaveClass(
    /ant-btn/,
  );
  await expect(page.getByTestId("library-problems-page-header")).toHaveClass(
    /items-center/,
  );
  await page.getByTestId("library-problems-back-link").click();
  await expect(page).toHaveURL(/\/library$/);
  await page.getByTestId("library-review-view-all").click();
  await expect(page).toHaveURL(/\/library\/problems$/);
  await expect(page.getByTestId("library-problems-workspace")).toBeVisible();
  await expect(page.getByTestId("library-problems-list")).toBeVisible();
  await expect(page.getByTestId("library-problems-stats-column")).toHaveCount(
    0,
  );
  await expect(
    page.locator(
      '[data-testid="library-problems-mixed-row"][data-library-kind="problem"]',
    ),
  ).toHaveCount(1);
  await expect(
    page
      .locator(
        '[data-testid="library-problems-mixed-row"][data-library-kind="submission"]',
      )
      .first(),
  ).toBeVisible();
  await expect(
    page.locator('a[href*="/writing/feedback/"]').first(),
  ).toBeVisible();
  await expect(page.locator('a[href*="?problem="]').first()).toBeVisible();

  const savedSearch = page
    .getByTestId("library-problems-search")
    .locator("input");
  await savedSearch.fill(fixture.marker);
  await expect(
    page.getByTestId("library-problems-mixed-row").first(),
  ).toBeVisible();
  await savedSearch.fill(`missing-${fixture.marker}`);
  await expect(page.getByTestId("library-problems-empty")).toBeVisible();

  await page.goto("/library", { waitUntil: "load" });

  await expect(
    page.getByTestId("library-feedback-waiting-panel"),
  ).toBeVisible();
  await expect(page.getByText("분석 실패").first()).toBeVisible();
  await expect(page.getByText("분석 중").first()).toBeVisible();
  await expect(page.getByTestId("library-weak-items-panel")).toBeVisible();
  await expect(page.getByText("구성").first()).toBeVisible();
  await expect(page.getByTestId("library-timeline-panel")).toBeVisible();
  await expect(page.getByText("답안 제출").first()).toBeVisible();
  await expect(page.getByText("피드백 확인").first()).toBeVisible();

  expect(errors).toEqual([]);
});

test("F-01 library timeline prefixes event labels with question numbers", async ({
  page,
}) => {
  const errors = collectErrors(page);
  const fixture = await createLibraryDashboardFixture();

  await page.goto("/library", { waitUntil: "load" });
  await expect(page).not.toHaveURL(/\/login/);

  const timeline = page.getByTestId("library-timeline-panel");
  await timeline.scrollIntoViewIfNeeded();
  await expect(timeline).toBeVisible();
  await expect(
    timeline.getByText(`${fixture.questionNo}번 답안 제출`).first(),
  ).toBeVisible();
  await expect(
    timeline.getByText(`${fixture.questionNo}번 피드백 확인`).first(),
  ).toBeVisible();

  expect(errors).toEqual([]);
});
