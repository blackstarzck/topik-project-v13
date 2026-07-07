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
  await expect(page.locator('a[href*="?problem="]').first()).toBeVisible();
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
  await expect(page.getByText("분석 실패").first()).toBeVisible();
  await expect(
    page.getByTestId("library-feedback-waiting-spinner").first(),
  ).toBeVisible();
  await expect(page.getByTestId("library-weak-items-panel")).toBeVisible();
  await expect(
    page
      .getByTestId("library-weak-items-panel")
      .locator(".ant-card-head-title"),
  ).toContainText("최근 낮게 나온 항목");
  await expect(page.getByText("최근 완료된 피드백 기준")).toHaveCount(0);
  await expect(page.getByText("구성").first()).toBeVisible();
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
    resultsColumn.getByTestId("library-problems-type-badge"),
  ).toHaveCount(0);
  await expect(resultsColumn).not.toContainText("분석 완료");
  const list = page.getByTestId("library-item-list");
  await expect(list).toBeVisible();
  await expect(list).not.toContainText(/\d{4}-\d{2}-\d{2}/);
  await expect(list).not.toContainText(/\d+자/);

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
    await expect(aside.getByTestId("library-problems-filter-reset")).toHaveAttribute(
      "aria-label",
      "필터 초기화",
    );
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
        datePresetOptionFontSize:
          window.getComputedStyle(datePresetOptionLabel).fontSize,
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

    await expect(
      drawerPanel,
    ).toBeVisible();
    await drawer.getByTestId("library-problems-filter-kind-problem").click();
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
