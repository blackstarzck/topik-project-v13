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
const PROBLEMS_ACTION_MENU_OPEN =
  "\ubb38\uc81c \uc791\uc5c5 \uba54\ub274 \uc5f4\uae30";
const PROBLEMS_ACTION_MENU_ITEMS = [
  "PDF \ub0b4\ubcf4\ub0b4\uae30",
  "\ub2e4\uc74c \ubb38\uc81c \ud480\uae30",
  "\ube44\uad50 \ub9ac\ud3ec\ud2b8",
  "\ub2e4\uc2dc \ud480\uae30",
] as const;
const ENV_LABEL = (process.env.SUPABASE_ENV_LABEL ?? "").toLowerCase();
const createdLibraryItemIds: string[] = [];
const createdSubmissionIds: string[] = [];
const createdStudyEventIds: string[] = [];
const createdProblemIds: string[] = [];
const createdDraftIds: string[] = [];

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

function q51Materials(marker: string) {
  return {
    question_id: `e2e-library-draft-${marker}`,
    blank_target_giyeok: "draft fixture first blank",
    blank_target_nieun: "draft fixture second blank",
    review: {
      validation: [`Library draft fixture ${marker}`],
    },
  };
}

function q51Rubric() {
  return {
    conditions: ["Complete the notice in a natural order."],
    criteria: ["content", "format", "sentence accuracy"],
  };
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
  const now = Date.now() - 15_000;
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
  createdSubmissionIds.push(
    ...completeSubmissionIds,
    analyzingSubmissionId,
    failedSubmissionId,
  );

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

  const staleLibraryItems = await sb
    .from("library_items")
    .delete()
    .eq("user_id", user.id);
  if (staleLibraryItems.error) throw staleLibraryItems.error;

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
  createdLibraryItemIds.push(...libraryIds);

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
  createdStudyEventIds.push(...studyEventIds);

  return {
    analyzingSubmissionId,
    marker,
    questionNo,
    problemTitle: problemTitle ?? `${questionNo}번 문제`,
    submittedEventId: studyEventIds[0],
    feedbackEventId: studyEventIds[1],
  };
}

async function createLibraryDraftFixture() {
  const sb = serviceClient();
  const users = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) throw users.error;
  const user = users.data.users.find(
    (candidate) => candidate.email?.toLowerCase() === EMAIL.toLowerCase(),
  );
  if (!user) throw new Error(`E2E student user not found: ${EMAIL}`);

  const marker = `f01-draft-${randomUUID().slice(0, 8)}`;
  const problemId = randomUUID();
  const draftId = randomUUID();
  const now = new Date(Date.now() - 10_000).toISOString();
  const title = `E2E library temporary draft ${marker}`;
  const answerText = `${marker} temporary draft answer`;

  const problem = await sb.from("problems").insert({
    id: problemId,
    source: "curated",
    domain: "writing",
    question_no: 51,
    topik_level: 2,
    difficulty: 3,
    title,
    prompt: "Complete the short-answer writing fixture.",
    materials: q51Materials(marker),
    answer_key: null,
    rubric: q51Rubric(),
    tags: [marker, "e2e-library-draft"],
    publish_status: "published",
    review_status: "approved",
    visibility: "public",
    lifecycle_status: "active",
    created_at: now,
    updated_at: now,
  });
  if (problem.error) throw problem.error;
  createdProblemIds.push(problemId);

  const draft = await sb.from("writing_drafts").insert({
    id: draftId,
    user_id: user.id,
    problem_id: problemId,
    question_no: 51,
    answer_text: answerText,
    answer_json: null,
    char_count: answerText.length,
    autosave_status: "clean",
    last_saved_at: now,
    created_at: now,
    updated_at: now,
  });
  if (draft.error) throw draft.error;
  createdDraftIds.push(draftId);

  return { marker, problemId, title };
}

async function cleanupLibraryFixtures() {
  if (
    createdLibraryItemIds.length === 0 &&
    createdSubmissionIds.length === 0 &&
    createdStudyEventIds.length === 0 &&
    createdProblemIds.length === 0 &&
    createdDraftIds.length === 0
  ) {
    return;
  }
  if (ENV_LABEL === "prod" || ENV_LABEL === "production") return;
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
  for (const id of createdDraftIds) {
    await sb.from("writing_drafts").delete().eq("id", id);
  }
  for (const id of createdProblemIds) {
    await sb.from("library_items").delete().eq("problem_id", id);
    await sb.from("writing_drafts").delete().eq("problem_id", id);
    await sb.from("problems").delete().eq("id", id);
  }
  createdLibraryItemIds.length = 0;
  createdSubmissionIds.length = 0;
  createdStudyEventIds.length = 0;
  createdProblemIds.length = 0;
  createdDraftIds.length = 0;
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
  await expect(page.getByTestId("library-kpi-card-reviewable")).toContainText(
    "12",
  );
  await expect(
    page.getByTestId("library-kpi-card-feedbackWaiting"),
  ).toContainText("2");
  await expect(page.getByTestId("library-kpi-card-comparison")).toContainText(
    /\d+/,
  );
  for (const testId of [
    "library-kpi-card-reviewable",
    "library-kpi-card-feedbackWaiting",
    "library-kpi-card-comparison",
  ]) {
    await expect(
      page.getByTestId(testId).getByTestId("library-kpi-value"),
    ).toHaveClass(/!text-\[24px\]/);
  }
  const recentStudyKpi = page.getByTestId("library-kpi-card-recentStudy");
  await expect(recentStudyKpi).toContainText(/최근 학습일 \d+월 \d+일/);
  await expect(
    recentStudyKpi.getByText("최근 학습", { exact: true }),
  ).toHaveCount(0);
  await expect(recentStudyKpi).toHaveText(
    /^\s*최근 학습일 \d+월 \d+일\s*마지막 학습 후 \d+(년|개월|주|일)\s*$/,
  );
  await expect(recentStudyKpi).toContainText(
    /마지막 학습 후 \d+(년|개월|주|일)/,
  );
  await expect(page.getByTestId("library-kpi-strip")).not.toContainText("건");
  await expect(page.getByTestId("library-tabs")).toHaveCount(0);
  await expect(page.getByTestId("library-type-filter")).toHaveCount(0);
  await expect(page.getByTestId("library-search")).toHaveCount(0);

  await expect(page.getByTestId("library-review-swiper")).toBeVisible();
  await expect(page.locator(".library-review-swiper-pagination")).toHaveCount(
    0,
  );
  const reviewCandidateQuestionLayout = await page
    .getByTestId("library-review-candidate-card")
    .first()
    .evaluate((card) => {
      const questionRow = card.querySelector(
        '[data-testid="library-review-candidate-question-row"]',
      );
      const content = card.querySelector(
        '[data-testid="library-review-candidate-content"]',
      );
      const questionNumber = card.querySelector(
        ".library-review-candidate-question-number",
      );
      const heading = card.querySelector(
        '[data-testid="library-review-candidate-heading"]',
      );

      if (!questionRow || !content || !questionNumber || !heading) {
        throw new Error("Review candidate question layout nodes are missing");
      }

      const questionRowRect = questionRow.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const questionStyle = window.getComputedStyle(questionNumber);

      return {
        childOrder: Array.from(heading.children).map((child) =>
          child.getAttribute("data-testid"),
        ),
        contentTop: contentRect.top,
        questionFontSize: questionStyle.fontSize,
        questionHeight: questionNumber.getBoundingClientRect().height,
        questionRowBottom: questionRowRect.bottom,
        questionWidth: questionNumber.getBoundingClientRect().width,
      };
    });
  expect(reviewCandidateQuestionLayout.childOrder).toEqual([
    "library-review-candidate-question-row",
    "library-review-candidate-content",
  ]);
  expect(reviewCandidateQuestionLayout.questionFontSize).toBe("18px");
  expect(reviewCandidateQuestionLayout.questionWidth).toBeLessThan(30);
  expect(reviewCandidateQuestionLayout.questionHeight).toBeLessThan(30);
  expect(reviewCandidateQuestionLayout.questionRowBottom).toBeLessThanOrEqual(
    reviewCandidateQuestionLayout.contentTop,
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
  await page.goto("/library/problems", { waitUntil: "load" });
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
  const completeSubmissionActionMenuButton = page
    .locator(
      '[data-testid="library-problems-mixed-row"][data-library-kind="submission"]',
    )
    .filter({ hasText: "F-01 dashboard fixture feedback summary." })
    .getByRole("button", { name: PROBLEMS_ACTION_MENU_OPEN })
    .first();
  await expect(completeSubmissionActionMenuButton).toBeVisible();
  await completeSubmissionActionMenuButton.click();
  for (const label of PROBLEMS_ACTION_MENU_ITEMS) {
    await expect(page.getByRole("menuitem", { name: label })).toBeVisible();
  }
  await page.keyboard.press("Escape");
  const savedProblemRow = page
    .locator(
      '[data-testid="library-problems-mixed-row"][data-library-kind="problem"]',
    )
    .first();
  await expect(
    savedProblemRow.getByRole("link", {
      name: PROBLEMS_ACTION_MENU_ITEMS[3],
    }),
  ).toHaveCount(0);
  await expect(
    savedProblemRow.getByRole("button", { name: PROBLEMS_ACTION_MENU_OPEN }),
  ).toBeVisible();
  await savedProblemRow
    .getByRole("button", { name: PROBLEMS_ACTION_MENU_OPEN })
    .click();
  const savedProblemActionMenu = page
    .getByRole("menu")
    .filter({ hasText: new RegExp(`^${PROBLEMS_ACTION_MENU_ITEMS[3]}$`) });
  await expect(savedProblemActionMenu).toBeVisible();
  await expect(
    savedProblemActionMenu.getByRole("menuitem", {
      name: PROBLEMS_ACTION_MENU_ITEMS[3],
    }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page
      .getByTestId("library-problems-list")
      .getByRole("button", { name: "삭제" }),
  ).toHaveCount(0);

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
  await expect(
    page
      .getByTestId("library-feedback-waiting-panel")
      .locator(".ant-card-head-title"),
  ).toContainText("피드백 대기");
  await expect(
    page
      .getByTestId("library-feedback-waiting-panel")
      .getByRole("button", { name: "분석 완료 여부 새로고침" }),
  ).toBeVisible();
  await expect(
    page.getByTestId("library-kpi-feedbackWaiting-refresh"),
  ).toBeVisible();
  await expect(
    page.getByTestId("library-feedback-waiting-spinner"),
  ).toBeVisible();
  await page.route("**/api/writing/evaluation-status?**", async (route) => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get("submissionId")).toBe(
      fixture.analyzingSubmissionId,
    );
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ feedback_status: "complete" }),
    });
  });
  const documentRequests: string[] = [];
  page.on("request", (request) => {
    if (
      request.resourceType() === "document" &&
      request.url().includes("/library")
    ) {
      documentRequests.push(request.url());
    }
  });
  await page.evaluate(() => {
    (
      window as Window & { __libraryReloadSentinel?: string }
    ).__libraryReloadSentinel = "library-refresh-kept";
  });
  await page.getByTestId("library-kpi-feedbackWaiting-refresh").click();
  await expect(
    page.getByTestId("library-kpi-card-feedbackWaiting"),
  ).toContainText("1");
  await expect(
    page
      .getByTestId("library-feedback-waiting-panel")
      .locator(
        `a[href*="/writing/feedback/"][href$="${fixture.analyzingSubmissionId}"]`,
      ),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { __libraryReloadSentinel?: string })
            .__libraryReloadSentinel,
      ),
    )
    .toBe("library-refresh-kept");
  expect(documentRequests).toEqual([]);
  await expect(page.getByText("분석 실패").first()).toBeVisible();
  await expect(
    page.getByTestId("library-feedback-waiting-spinner"),
  ).toHaveCount(0);
  await expect(page.getByTestId("library-weak-items-panel")).toHaveCount(0);
  await expect(page.getByTestId("library-timeline-panel")).toBeVisible();
  await expect(
    page.getByTestId("library-timeline-panel").locator(".ant-card-head-title"),
  ).toContainText("학습 타임라인");
  await expect(page.getByText("답안 제출").first()).toBeVisible();
  await expect(page.getByText("피드백 확인").first()).toBeVisible();
  await expect(
    page
      .getByTestId("library-timeline-panel")
      .getByRole("link", { name: "전체 타임라인 보기" }),
  ).toHaveCount(0);

  expect(errors).toEqual([]);
});

test("F-01 library problems filter panel, sort, and view toggle", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await createLibraryDashboardFixture();

  await page.goto("/library/problems", { waitUntil: "load" });
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByTestId("library-problems-list")).toBeVisible();
  await expect(page.getByTestId("library-problems-result-count")).toHaveCount(
    0,
  );
  await expect(
    page.getByTestId("library-problems-toolbar-controls"),
  ).toBeVisible();

  const viewport = page.viewportSize();
  const isDesktop = (viewport?.width ?? 0) >= 1024;
  const problemRows = page.locator(
    '[data-testid="library-problems-mixed-row"][data-library-kind="problem"]',
  );
  const submissionRows = page.locator(
    '[data-testid="library-problems-mixed-row"][data-library-kind="submission"]',
  );
  const resultsColumn = page.getByTestId("library-problems-results-column");
  await expect(
    resultsColumn.getByTestId("library-problems-question-number").first(),
  ).toBeVisible();
  await expect(resultsColumn).not.toContainText(/No\.\s*5[1-4]/);
  await expect(
    resultsColumn.getByTestId("library-problems-type-badge").first(),
  ).toContainText("북마크");
  await expect(resultsColumn).not.toContainText("분석 완료");
  const list = page.getByTestId("library-item-list");
  await expect(list).toBeVisible();
  await expect(list).not.toContainText(/\d{4}-\d{2}-\d{2}/);
  await expect(list).not.toContainText(/\d+자/);

  const completeSubmissionRow = submissionRows
    .filter({ hasText: "F-01 dashboard fixture feedback summary." })
    .first();
  await expect(completeSubmissionRow).toBeVisible();
  const submissionActionMenu = completeSubmissionRow.getByRole("button", {
    name: PROBLEMS_ACTION_MENU_OPEN,
  });
  await expect(submissionActionMenu).toBeVisible();
  const failedSubmissionRow = submissionRows
    .filter({ hasText: "F-01 dashboard fixture failed feedback." })
    .first();
  await expect(failedSubmissionRow).toBeVisible();
  await expect(
    failedSubmissionRow.getByRole("button", {
      name: PROBLEMS_ACTION_MENU_OPEN,
    }),
  ).toHaveCount(0);
  await expect(
    problemRows.first().getByRole("button", {
      name: PROBLEMS_ACTION_MENU_OPEN,
    }),
  ).toBeVisible();
  await expect(
    problemRows.first().getByRole("link", {
      name: PROBLEMS_ACTION_MENU_ITEMS[3],
    }),
  ).toHaveCount(0);
  await problemRows
    .first()
    .getByRole("button", { name: PROBLEMS_ACTION_MENU_OPEN })
    .click();
  const problemActionMenu = page
    .getByRole("menu")
    .filter({ hasText: new RegExp(`^${PROBLEMS_ACTION_MENU_ITEMS[3]}$`) });
  await expect(problemActionMenu).toBeVisible();
  await expect(
    problemActionMenu.getByRole("menuitem", {
      name: PROBLEMS_ACTION_MENU_ITEMS[3],
    }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await submissionActionMenu.click();
  const actionMenu = page
    .getByRole("menu")
    .filter({ hasText: PROBLEMS_ACTION_MENU_ITEMS[0] });
  await expect(actionMenu).toBeVisible();
  for (const label of PROBLEMS_ACTION_MENU_ITEMS) {
    await expect(
      actionMenu.getByRole("menuitem", { name: label }),
    ).toBeVisible();
  }
  const menuBox = await actionMenu.boundingBox();
  const viewportBox = page.viewportSize();
  expect(menuBox).not.toBeNull();
  expect(viewportBox).not.toBeNull();
  if (menuBox && viewportBox) {
    expect(menuBox.x).toBeGreaterThanOrEqual(0);
    expect(menuBox.y).toBeGreaterThanOrEqual(0);
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(
      viewportBox.width + 1,
    );
    expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(
      viewportBox.height + 1,
    );
  }
  await page.keyboard.press("Escape");
  await expect(actionMenu).toBeHidden();

  if (isDesktop) {
    // 데스크톱: 우측 aside 필터 패널이 보이고 모바일 필터 버튼은 숨겨진다.
    const aside = page.getByTestId("library-problems-filter-panel-desktop");
    await expect(aside).toBeVisible();
    await expect(page.getByTestId("library-problems-filter-open")).toBeHidden();
    const desktopFilterPanelOverflow = await aside.evaluate((node) => ({
      clientWidth: node.clientWidth,
      overflowX: window.getComputedStyle(node).overflowX,
      scrollWidth: node.scrollWidth,
      width: node.getBoundingClientRect().width,
    }));
    expect(desktopFilterPanelOverflow.width).toBeGreaterThanOrEqual(352);
    expect(desktopFilterPanelOverflow.overflowX).toBe("hidden");
    await expect(aside.getByTestId("library-problems-filter-reset")).toHaveText(
      "",
    );
    await expect(
      aside.getByTestId("library-problems-filter-reset"),
    ).toHaveAttribute("aria-label", "필터 초기화");
    const filterResetButtonRightInset = await aside.evaluate((node) => {
      const resetButton = node.querySelector(
        '[data-testid="library-problems-filter-reset"]',
      );
      if (!resetButton) {
        throw new Error("Library problems filter reset button is missing");
      }

      return (
        node.getBoundingClientRect().right -
        resetButton.getBoundingClientRect().right
      );
    });
    expect(filterResetButtonRightInset).toBeGreaterThanOrEqual(8);
    const filterPanelSpacing = await aside.evaluate((node) => {
      const dateStack = node.querySelector(
        '[data-testid="library-problems-filter-date-stack"]',
      );
      const scoreSlider = node.querySelector(
        '[data-testid="library-problems-filter-score-slider"]',
      );
      const dateRange = node.querySelector(
        '[data-testid="library-problems-filter-date-range"]',
      );
      const datePresetGroup = node.querySelector(
        '[data-testid="library-problems-filter-date-presets"]',
      );
      const datePresetOption = node.querySelector(
        '[data-testid="library-problems-filter-date-presets"] .ant-radio-wrapper',
      );
      const datePresetOptionLabel = node.querySelector(
        '[data-testid="library-problems-filter-date-presets"] .ant-radio-wrapper > span:last-child',
      );
      const datePicker = node.querySelector(
        '[data-testid="library-problems-filter-date-range"] .ant-picker',
      );
      const slider = node.querySelector(
        '[data-testid="library-problems-filter-score-slider"] .ant-slider',
      );

      if (
        !dateStack ||
        !dateRange ||
        !datePresetGroup ||
        !scoreSlider ||
        !datePresetOption ||
        !datePresetOptionLabel ||
        !datePicker ||
        !slider
      ) {
        throw new Error("Library problems filter spacing nodes are missing");
      }

      const asideRect = node.getBoundingClientRect();
      const datePickerRect = datePicker.getBoundingClientRect();
      const sliderRect = slider.getBoundingClientRect();
      const datePresetGroupStyle = window.getComputedStyle(datePresetGroup);
      const dateRangeStyle = window.getComputedStyle(dateRange);
      const scoreSliderStyle = window.getComputedStyle(scoreSlider);

      return {
        dateStackGap: window.getComputedStyle(dateStack).rowGap,
        datePresetGroupDisplay: datePresetGroupStyle.display,
        datePresetGroupColumnGap: datePresetGroupStyle.columnGap,
        datePresetGroupRowGap: datePresetGroupStyle.rowGap,
        datePresetOptionGap:
          window.getComputedStyle(datePresetOption).columnGap,
        datePresetOptionFontSize: window.getComputedStyle(datePresetOptionLabel)
          .fontSize,
        dateRangePaddingLeft: dateRangeStyle.paddingLeft,
        dateRangePaddingRight: dateRangeStyle.paddingRight,
        datePickerLeftInset: datePickerRect.left - asideRect.left,
        datePickerRightInset: asideRect.right - datePickerRect.right,
        scorePaddingLeft: scoreSliderStyle.paddingLeft,
        scorePaddingRight: scoreSliderStyle.paddingRight,
        sliderLeftInset: sliderRect.left - asideRect.left,
        sliderRightInset: asideRect.right - sliderRect.right,
      };
    });
    expect(filterPanelSpacing.dateStackGap).toBe("16px");
    expect(filterPanelSpacing.datePresetGroupDisplay).toBe("grid");
    expect(filterPanelSpacing.datePresetGroupColumnGap).toBe("32px");
    expect(filterPanelSpacing.datePresetGroupRowGap).toBe("20px");
    expect(filterPanelSpacing.datePresetOptionGap).toBe("10px");
    expect(filterPanelSpacing.datePresetOptionFontSize).toBe("14px");
    expect(filterPanelSpacing.dateRangePaddingLeft).toBe("12px");
    expect(filterPanelSpacing.dateRangePaddingRight).toBe("12px");
    expect(filterPanelSpacing.datePickerLeftInset).toBeGreaterThanOrEqual(12);
    expect(filterPanelSpacing.datePickerRightInset).toBeGreaterThanOrEqual(12);
    expect(filterPanelSpacing.scorePaddingLeft).toBe("12px");
    expect(filterPanelSpacing.scorePaddingRight).toBe("12px");
    expect(filterPanelSpacing.sliderLeftInset).toBeGreaterThanOrEqual(12);
    expect(filterPanelSpacing.sliderRightInset).toBeGreaterThanOrEqual(12);
    const toolbarControls = page.getByTestId(
      "library-problems-toolbar-controls",
    );
    await expect(toolbarControls).toBeVisible();
    const desktopToolbarLayout = await page.evaluate(() => {
      const controls = document.querySelector(
        '[data-testid="library-problems-toolbar-controls"]',
      );
      const asideEl = document.querySelector(
        '[data-testid="library-problems-filter-panel-desktop"]',
      );
      const resultsColumn = document.querySelector(
        '[data-testid="library-problems-results-column"]',
      );

      if (!controls || !asideEl || !resultsColumn) {
        throw new Error("Library problems toolbar layout nodes are missing");
      }

      return {
        asideLeft: asideEl.getBoundingClientRect().left,
        controlsRight: controls.getBoundingClientRect().right,
        resultsRight: resultsColumn.getBoundingClientRect().right,
      };
    });
    expect(desktopToolbarLayout.controlsRight).toBeLessThanOrEqual(
      desktopToolbarLayout.resultsRight + 1,
    );
    expect(desktopToolbarLayout.controlsRight).toBeLessThan(
      desktopToolbarLayout.asideLeft,
    );
    const asideStickyTop = await aside.evaluate((node) =>
      Number.parseFloat(window.getComputedStyle(node).top),
    );
    await page.evaluate(() => window.scrollTo(0, 320));
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(0);
    const scrolledAsideTop = await aside.evaluate(
      (node) => node.getBoundingClientRect().top,
    );
    expect(Math.abs(scrolledAsideTop - asideStickyTop)).toBeLessThanOrEqual(1);

    const viewToggleIconOffsets = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll(
          ".library-problems-view-toggle .ant-segmented-item",
        ),
      ).map((item) => {
        const svg = item.querySelector("svg");
        if (!svg) throw new Error("View toggle icon SVG is missing");

        const itemRect = item.getBoundingClientRect();
        const svgRect = svg.getBoundingClientRect();
        return {
          dx: Math.abs(
            svgRect.left +
              svgRect.width / 2 -
              (itemRect.left + itemRect.width / 2),
          ),
          dy: Math.abs(
            svgRect.top +
              svgRect.height / 2 -
              (itemRect.top + itemRect.height / 2),
          ),
        };
      }),
    );
    for (const offset of viewToggleIconOffsets) {
      expect(offset.dx).toBeLessThanOrEqual(1);
      expect(offset.dy).toBeLessThanOrEqual(1);
    }

    // 저장 문제 체크 → 문제 행만 남는다.
    await aside.getByTestId("library-problems-filter-kind-problem").click();
    await expect(problemRows).toHaveCount(1);
    await expect(submissionRows).toHaveCount(0);

    // 분석 실패 추가 체크 → 브랜치 합집합(실패 답안 ∪ 저장 문제).
    await aside.getByTestId("library-problems-filter-status-failed").click();
    await expect(problemRows).toHaveCount(1);
    await expect(submissionRows).toHaveCount(1);

    // 필터 초기화 → 전체 목록 복귀(페이지당 10행).
    await aside.getByTestId("library-problems-filter-reset").click();
    await expect(page.getByTestId("library-problems-mixed-row")).toHaveCount(
      10,
    );

    // 점수 범위 슬라이더(키보드 조작) → 점수 없는 항목(분석 중/실패, 저장 문제) 제외.
    const minHandle = aside
      .getByTestId("library-problems-filter-score-slider")
      .locator('[role="slider"]')
      .first();
    await minHandle.focus();
    await page.keyboard.press("ArrowRight");
    await expect(problemRows).toHaveCount(0);
    await expect(submissionRows).toHaveCount(10);
    await aside.getByTestId("library-problems-filter-reset").click();

    // 정렬: 점수 높은 순 → 점수 없는 항목이 뒤로 가고 답안이 첫 행.
    await page.getByTestId("library-problems-sort").click();
    await page
      .locator(".ant-select-item-option", { hasText: "점수 높은 순" })
      .click();
    await expect(
      page.getByTestId("library-problems-mixed-row").first(),
    ).toHaveAttribute("data-library-kind", "submission");

    // 뷰 전환: 카드 그리드 ↔ 리스트.
    await page.getByTitle("카드 보기").click();
    const cardGrid = page.getByTestId("library-problems-card-grid");
    await expect(cardGrid).toBeVisible();
    await expect(page.getByTestId("library-problems-mixed-row")).toHaveCount(
      10,
    );
    await expect(
      cardGrid.getByRole("button", { name: PROBLEMS_ACTION_MENU_OPEN }).first(),
    ).toBeVisible();
    await expect(cardGrid).not.toContainText(/\d{4}-\d{2}-\d{2}/);
    await expect(cardGrid).not.toContainText(/\d+자/);
    await page.getByTitle("리스트 보기").click();
    await expect(page.getByTestId("library-item-list")).toBeVisible();
  } else {
    // 모바일/태블릿: aside는 숨겨지고 필터 버튼 → Drawer로 연다.
    await expect(
      page.getByTestId("library-problems-filter-panel-desktop"),
    ).toBeHidden();
    const drawer = page.locator(".app-drawer");
    const drawerPanel = drawer.getByTestId("library-problems-filter-panel");
    await expect(async () => {
      await page.getByTestId("library-problems-filter-open").click();
      await expect(drawerPanel).toBeVisible({ timeout: 2_500 });
    }).toPass({ timeout: 8_000 });

    await expect(drawerPanel).toBeVisible();
    const drawerProblemKindInput = drawer.getByTestId(
      "library-problems-filter-kind-problem",
    );
    await drawerProblemKindInput.check();
    await expect(drawerProblemKindInput).toBeChecked();
    await drawer.getByTestId("library-problems-filter-drawer-apply").click();
    await expect(
      drawer.getByTestId("library-problems-filter-panel"),
    ).toBeHidden();

    await expect(problemRows).toHaveCount(1);
    await expect(submissionRows).toHaveCount(0);
    await expect(
      page.getByTestId("library-problems-filter-badge"),
    ).toContainText("1");
  }

  expect(errors).toEqual([]);
});

test("F-01 library problems temporary draft filter is separate from saved items", async ({
  page,
}) => {
  const errors = collectErrors(page);
  const fixture = await createLibraryDraftFixture();

  await page.goto("/library/problems", { waitUntil: "load" });
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByTestId("library-problems-list")).toBeVisible();

  const searchInput = page
    .getByTestId("library-problems-search")
    .locator("input");
  await expect(searchInput).toHaveAttribute("placeholder", /임시 저장/);
  await searchInput.fill(fixture.marker);

  const rows = page.getByTestId("library-problems-mixed-row");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toHaveAttribute("data-library-kind", "draft");
  await expect(
    rows.first().getByTestId("library-problems-type-badge"),
  ).toContainText("임시 저장");
  await expect(rows.first()).toContainText("E2E library temporary draft");
  await expect(rows.first()).toContainText(fixture.marker);
  await expect(
    rows.first().getByRole("link", { name: "이어쓰기" }),
  ).toHaveCount(0);
  await rows
    .first()
    .getByRole("button", { name: PROBLEMS_ACTION_MENU_OPEN })
    .click();
  const draftActionMenu = page
    .getByRole("menu")
    .filter({ hasText: "이어쓰기" });
  await expect(draftActionMenu).toBeVisible();
  await expect(
    draftActionMenu.getByRole("menuitem", { name: "이어쓰기" }),
  ).toBeVisible();
  await draftActionMenu.getByRole("menuitem", { name: "이어쓰기" }).click();
  await expect(page).toHaveURL(
    new RegExp(
      `/writing/short-answer-writing-51\\?problem=${fixture.problemId}`,
    ),
  );
  await page.goto("/library/problems", { waitUntil: "load" });
  await searchInput.fill(fixture.marker);
  await expect(rows).toHaveCount(1);

  const viewport = page.viewportSize();
  const isDesktop = (viewport?.width ?? 0) >= 1024;
  const panel = isDesktop
    ? page.getByTestId("library-problems-filter-panel-desktop")
    : page.locator(".app-drawer").getByTestId("library-problems-filter-panel");

  if (!isDesktop) {
    await page.getByTestId("library-problems-filter-open").click();
  }
  await expect(panel).toBeVisible();

  const itemTypeGroup = panel.getByTestId(
    "library-problems-filter-group-item-type",
  );
  await expect(itemTypeGroup).toContainText("저장 답안");
  await expect(itemTypeGroup).toContainText("북마크한 문제");
  await expect(itemTypeGroup).toContainText("임시 저장");
  await expect(itemTypeGroup).not.toContainText("제공 종료");
  await expect(itemTypeGroup).not.toContainText("이용 불가");
  await expect(
    panel.getByTestId("library-problems-filter-group-problem-availability"),
  ).toContainText("제공 종료");
  await expect(
    panel.getByTestId("library-problems-filter-group-problem-availability"),
  ).toContainText("이용 불가");

  await panel.getByTestId("library-problems-filter-kind-draft").click();
  if (!isDesktop) {
    await page.getByTestId("library-problems-filter-drawer-apply").click();
  }

  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toHaveAttribute("data-library-kind", "draft");
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
    page.getByTestId(`library-timeline-content-${fixture.submittedEventId}`),
  ).toContainText(`${fixture.questionNo}번`);
  await expect(
    page.getByTestId(`library-timeline-content-${fixture.feedbackEventId}`),
  ).toContainText(`${fixture.questionNo}번`);

  expect(errors).toEqual([]);
});
