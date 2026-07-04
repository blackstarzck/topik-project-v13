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

// Paginate the auth user list so the student is found even past the first 1000
// users (mirrors tests/e2e/_setup/e2e-student-fixture.ts findUserByEmail).
async function findStudentUser(sb: ReturnType<typeof serviceClient>) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await sb.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;
    const match = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === EMAIL.toLowerCase(),
    );
    if (match) return match;
    if (data.users.length < 1000) break;
  }
  throw new Error(
    "E2E student user not found for E2E_STUDENT_EMAIL — run the setup project first and check .env.local",
  );
}

async function createCompletedLongFeedbackSubmission({
  questionNo = 53,
  sentenceFeedbackTexts,
  answerSections,
}: {
  questionNo?: 53 | 54;
  sentenceFeedbackTexts?: string[];
  answerSections?: { intro: string; body: string; conclusion: string };
} = {}) {
  const sb = serviceClient();
  const user = await findStudentUser(sb);

  const problem = await sb
    .from("problems")
    .select("id")
    .eq("domain", "writing")
    .eq("question_no", questionNo)
    .eq("publish_status", "published")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (problem.error) throw problem.error;
  if (!problem.data?.id)
    throw new Error(
      `No published q${questionNo} writing problem found in this Supabase project (NEXT_PUBLIC_SUPABASE_URL). Seed at least one published q53/q54 problem before running E-02 e2e.`,
    );

  const drafts = await sb
    .from("writing_drafts")
    .delete()
    .eq("user_id", user.id)
    .eq("problem_id", problem.data.id);
  if (drafts.error) throw drafts.error;

  const submissionId = randomUUID();
  // Register for cleanup before the first insert so a partial failure mid-way
  // still gets torn down by afterAll instead of leaking rows.
  createdSubmissionIds.push(submissionId);
  // 실제 53 제출과 동일하게 서론/본론/결론 섹션 + combine53Sections 형태(\n\n 결합)로
  // 저장한다. 문장별 첨삭 그룹은 이 섹션 텍스트에 원문을 대조해 만들어진다.
  const sections = answerSections ?? {
    intro: "첫째, 자료에서 가장 큰 변화는 방문자 수 증가입니다.",
    body: [
      "둘째, 2024년 이후 온라인 신청 비율이 빠르게 높아졌습니다.",
      "그러므로 기관은 모바일 안내를 강화해야 합니다.",
      "또한 오프라인 방문자를 위한 안내도 유지할 필요가 있습니다.",
    ].join(" "),
    conclusion: [
      "마지막으로 두 방식의 균형을 맞추는 것이 중요합니다.",
      "이런 변화는 이용자 편의가 중요한 기준이 되었음을 보여 줍니다.",
    ].join(" "),
  };
  const answerText = [sections.intro, sections.body, sections.conclusion].join(
    "\n\n",
  );
  const inserted = await sb.from("writing_submissions").insert({
    id: submissionId,
    user_id: user.id,
    problem_id: problem.data.id,
    question_no: questionNo,
    answer_text: answerText,
    answer_json:
      questionNo === 53 ? { _v: "53.v1", sections } : null,
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

  // 기본 첨삭 6개: 서론 1개 + 본론 3개 + 결론 2개 (각 원문은 해당 섹션의 부분 문자열).
  const defaultSentenceTexts = [
    "자료에서 가장 큰 변화는 방문자 수 증가입니다.",
    "온라인 신청 비율이 빠르게 높아졌습니다.",
    "기관은 모바일 안내를 강화해야 합니다.",
    "오프라인 방문자를 위한 안내도 유지할 필요가 있습니다.",
    "두 방식의 균형을 맞추는 것이 중요합니다.",
    "이용자 편의가 중요한 기준이 되었음을 보여 줍니다.",
  ];
  const sentenceRows = (sentenceFeedbackTexts ?? defaultSentenceTexts).map(
    (text, index) => ({
      submission_id: submissionId,
      user_id: user.id,
      sentence_index: index,
      original_text: text,
      corrected_text: `${text} (수정 제안 ${index + 1})`,
      comment: `문장 ${index + 1}의 연결과 표현을 다듬는 제안입니다.`,
    }),
  );
  const sentences = await sb.from("sentence_feedback").insert(sentenceRows);
  if (sentences.error) throw sentences.error;

  // Read the rows back so a silently-dropped insert surfaces here (with a clear
  // message) instead of later as a confusing 404 on the feedback route.
  const verifySubmission = await sb
    .from("writing_submissions")
    .select("id, feedback_status")
    .eq("id", submissionId)
    .maybeSingle();
  if (verifySubmission.error) throw verifySubmission.error;
  if (!verifySubmission.data) {
    throw new Error(
      `E-02 fixture verification failed: writing_submissions row ${submissionId} missing after insert`,
    );
  }
  const verifyFeedback = await sb
    .from("writing_feedback")
    .select("status")
    .eq("submission_id", submissionId)
    .maybeSingle();
  if (verifyFeedback.error) throw verifyFeedback.error;
  if (!verifyFeedback.data) {
    throw new Error(
      `E-02 fixture verification failed: writing_feedback row for ${submissionId} missing after insert`,
    );
  }

  return { submissionId, answerText, sections };
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

test("E-02 long feedback matches the wireframe constraints", async ({
  page,
}) => {
  const errors = collectErrors(page);
  const { submissionId, sections } =
    await createCompletedLongFeedbackSubmission();

  const response = await page.goto(`/writing/feedback/long/${submissionId}`, {
    waitUntil: "networkidle",
  });
  expect(
    response?.status(),
    `long feedback route returned ${response?.status()} — a 404 means the fixture row is not visible to the logged-in e2e student (stale tests/e2e/auth-state/student.json or E2E_STUDENT_EMAIL mismatch)`,
  ).toBeLessThan(400);
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByTestId("feedback-page-header")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator(".app-workspace-sider")).toHaveCount(0);
  await expect(
    page.locator(".app-notification-corner, .app-workspace-mobile-actions"),
  ).toHaveCount(0);

  await expect(page.getByTestId("feedback-summary")).toBeVisible();
  await expect(page.locator(".ant-statistic")).toBeVisible();
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
    page.getByTestId("feedback-summary-meta").locator(".ant-tag"),
  ).toHaveCount(4);
  await expect(
    page
      .getByTestId("feedback-summary")
      .locator(".ant-typography")
      .filter({ hasText: "자료의 변화 방향은 잘 설명했습니다." }),
  ).not.toHaveClass(/ant-typography-ellipsis/);
  await expect(page.getByTestId("feedback-dimension-card")).toHaveCount(0);
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
  await expect(
    page.getByTestId("feedback-report-total-score-card"),
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
  await expect(page.getByTestId("feedback-report-score-item")).toHaveCount(4);

  const sentenceCard = page.getByTestId("feedback-sentence-card");
  await expect(sentenceCard).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 5, name: "문장별 첨삭" }),
  ).toBeVisible();
  // 첨삭 6개 중 5개만 먼저 노출(wireframe: 5개 후 더보기). 그룹 헤더는
  // 섹션당 1번만 나타난다 — 본론 첨삭이 3개여도 "본론" 헤더는 1개다.
  await expect(sentenceCard.getByRole("listitem")).toHaveCount(5);
  const groupLabels = sentenceCard.getByTestId(
    "feedback-sentence-group-label",
  );
  await expect(groupLabels).toHaveText(["서론", "본론", "결론"]);
  await expect(sentenceCard.getByText("본론")).toHaveCount(1);
  await expect(sentenceCard.getByText("빈칸")).toHaveCount(0);
  await expect(sentenceCard.getByRole("button")).toBeVisible();
  await sentenceCard.getByRole("button").click();
  await expect(sentenceCard.getByRole("listitem")).toHaveCount(6);
  await expect(groupLabels).toHaveText(["서론", "본론", "결론"]);

  await expect(page.getByTestId("feedback-detail-panel")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 5, name: "상세 피드백" }),
  ).toBeVisible();
  const detailPanel = page.getByTestId("feedback-detail-panel");
  await expect(detailPanel.getByTestId("feedback-detail-item")).toHaveCount(3);
  await expect(detailPanel.getByText("논리")).toHaveCount(0);
  await expect(detailPanel.getByText("구조")).toHaveCount(0);
  await expect(page.getByTestId("feedback-recommendation-card")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 5, name: "추천 학습" }),
  ).toBeVisible();
  const bodySectionIds = await page
    .getByTestId("feedback-page-body")
    .evaluate((body) => {
      return Array.from(body.children).map((element) =>
        element.getAttribute("data-testid"),
      );
    });
  expect(bodySectionIds).toEqual([
    "feedback-summary",
    "feedback-report-criteria-card",
    "feedback-report-focus-card",
    "feedback-sentence-card",
    "feedback-recommendation-card",
    "feedback-detail-panel",
  ]);
  expect(
    await page.locator('[data-testid^="feedback-reco-"]').count(),
  ).toBeLessThanOrEqual(3);

  await expect(page.getByTestId("feedback-page-header")).toBeVisible();
  await expect(page.getByTestId("feedback-page-header")).toHaveCSS(
    "position",
    "sticky",
  );
  const headerQuestionNo = page.getByTestId("feedback-title-question-no");
  await expect(headerQuestionNo).toHaveText("53");
  await expect(headerQuestionNo).toHaveCSS("font-family", /Space Grotesk/);
  await expect(headerQuestionNo).toHaveCSS(
    "background-image",
    /neon-orange\.png/,
  );
  await expect(page.getByTestId("feedback-actions")).toHaveCount(1);

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
    "다시 작성",
  );
  await expect(page.getByTestId("feedback-action-pdf")).toHaveText("PDF 저장");
  await expect(page.getByTestId("feedback-action-save")).toHaveCount(0);
  await expect(page.getByTestId("feedback-header-back-link")).toHaveAttribute(
    "href",
    "/library",
  );
  await expect(page.getByTestId("feedback-header-back-link")).toHaveAttribute(
    "aria-label",
    "내 서재로 돌아가기",
  );

  await page.getByTestId("feedback-action-retry").click();
  await page.waitForURL((url) => {
    return (
      url.pathname === "/writing/long-form-writing-53" &&
      url.searchParams.get("fresh") === "1" &&
      url.searchParams.get("retrySubmission") === submissionId
    );
  });
  await page.getByRole("tab").nth(1).click();
  // answer_json(53.v1)이 있으므로 재작성 에디터는 섹션별로 시드된다.
  await expect(
    page.locator(".writing-workspace--q53 textarea").nth(0),
  ).toHaveValue(sections.intro);
  await expect(
    page.locator(".writing-workspace--q53 textarea").nth(1),
  ).toHaveValue(sections.body);

  expect(errors).toEqual([]);
});

test("Q54 long feedback anchors corrections to answer paragraphs and keeps unanchored advice in 전체", async ({
  page,
}) => {
  const errors = collectErrors(page);
  const { submissionId } = await createCompletedLongFeedbackSubmission({
    questionNo: 54,
    // q54는 answer_json 없이 문단(빈 줄) 경계로 서론/본론/결론을 앵커한다.
    answerSections: {
      intro: "온라인 수업은 시간과 장소의 제약이 적다는 장점이 있습니다.",
      body: "하지만 집중력이 떨어지기 쉽고 실습 과목에는 한계가 있습니다.",
      conclusion: "그러므로 상황에 맞게 두 방식을 병행하는 것이 바람직합니다.",
    },
    sentenceFeedbackTexts: [
      "시간과 장소의 제약이 적다는 장점",
      "두 방식을 병행하는 것이 바람직합니다",
      "문단을 나누어 글의 구조를 분명히 하세요.",
    ],
  });

  const response = await page.goto(`/writing/feedback/long/${submissionId}`, {
    waitUntil: "networkidle",
  });
  expect(
    response?.status(),
    `long feedback route returned ${response?.status()} — a 404 means the fixture row is not visible to the logged-in e2e student (stale tests/e2e/auth-state/student.json or E2E_STUDENT_EMAIL mismatch)`,
  ).toBeLessThan(400);
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByTestId("feedback-page-header")).toBeVisible({
    timeout: 15_000,
  });

  const sentenceCard = page.getByTestId("feedback-sentence-card");
  const sentenceItems = sentenceCard.getByRole("listitem");
  await expect(sentenceCard).toBeVisible();
  await expect(sentenceItems).toHaveCount(3);
  // \uCCA8\uC0AD\uC774 \uBD99\uC740 \uC139\uC158\uB9CC \uD5E4\uB354\uAC00 \uB098\uD0C0\uB098\uACE0(\uBCF8\uB860 \uCCA8\uC0AD \uC5C6\uC74C \u2192 \uBCF8\uB860 \uD5E4\uB354 \uC5C6\uC74C),
  // \uB2F5\uC548 \uD14D\uC2A4\uD2B8\uC5D0 \uC575\uCEE4\uB418\uC9C0 \uC54A\uB294 \uBB38\uC11C \uC218\uC900 \uC870\uC5B8\uC740 "\uC804\uCCB4"\uB85C \uD45C\uAE30\uB41C\uB2E4.
  await expect(
    sentenceCard.getByTestId("feedback-sentence-group-label"),
  ).toHaveText(["\uC11C\uB860", "\uACB0\uB860", "\uC804\uCCB4"]);
  await expect(sentenceCard.getByText(/^\uBCF8\uB860$/)).toHaveCount(0);

  expect(errors).toEqual([]);
});
