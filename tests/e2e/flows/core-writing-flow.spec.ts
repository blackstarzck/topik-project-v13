import { readFileSync } from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Tier 3 — core user flow (D4). One scenario, asserted step by step, so a break
// anywhere in the chain fails loudly:
//   dashboard → problem list → writing-51 → submit-confirm (D-M1) → submit →
//   feedback (E-01) → save to library → comparison report (R-01) → library (F-01)
//   → PDF export modal (F-M1).
// The real submit creates a submission (+ feedback/dimensions/sentences) and the
// save/compare create a library_item + comparison_report; afterAll deletes exactly
// those rows (tracked by the new submission id) so the shared dev DB stays clean.
// Runs once on the desktop-1280 project only (flow correctness, not responsive).

// --- service client for teardown (dev only; never logs secrets) ---
function loadEnvLocal() {
  try {
    const raw = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      )
        v = v.slice(1, -1);
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch {
    /* CI */
  }
}
loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

// Track EVERY submission this spec creates (retries create extra rows); clean them all.
const createdSubmissionIds: string[] = [];

const FLOW_DIMENSIONS = [
  ["grammar", 72, 4],
  ["vocab", 84, 2],
  ["structure", 76, 3],
  ["content", 88, 1],
  ["expression", 79, 3],
  ["topic_fit", 90, 1],
] as const;

type FlowSubmission = {
  id: string;
  user_id: string;
  answer_text: string;
  char_count: number;
};

function serviceClient() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error(
      "Missing Supabase service credentials for core writing flow",
    );
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSubmittedFlowRow(answerToken: string) {
  const sb = serviceClient();
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    const { data, error } = await sb
      .from("writing_submissions")
      .select("id,user_id,answer_text,char_count")
      .like("answer_text", `%${answerToken}%`)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) return data as FlowSubmission;
    await wait(500);
  }

  throw new Error("Timed out waiting for the flow-created writing submission");
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
      "Core flow fixture feedback confirms the submitted answer can proceed from analysis to feedback.",
    ai_model: "e2e-fixture",
    ai_model_version: "core-flow",
  });
  if (feedback.error) throw feedback.error;

  const dimensions = await sb.from("feedback_dimension_scores").insert(
    FLOW_DIMENSIONS.map(([dimension, score, weaknessLevel]) => ({
      submission_id: submission.id,
      user_id: submission.user_id,
      dimension,
      score,
      score_max: 100,
      summary: `Core flow ${dimension} feedback.`,
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
      comment: "Core flow fixture sentence feedback.",
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
  "core writing flow requires Supabase service credentials for cleanup and analysis completion fixture",
);

test.afterAll(async () => {
  if (createdSubmissionIds.length === 0) return;
  const label = (process.env.SUPABASE_ENV_LABEL || "").toLowerCase();
  if (label === "prod" || label === "production") return; // never touch prod
  const sb = serviceClient();
  for (const id of createdSubmissionIds) {
    // Delete children first (in case FKs are not ON DELETE CASCADE), then the row.
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
  console.log(
    `[flow teardown] removed ${createdSubmissionIds.length} flow-created submission(s) + children`,
  );
});

test("core writing flow: dashboard → write → submit → feedback → compare → library → export", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  test.skip(
    testInfo.project.name !== "desktop-1280",
    "flow runs once on desktop-1280",
  );
  const answerToken = `core-flow-${Date.now()}-${testInfo.retry}`;
  const blankOneAnswer = `조용한 방으로 바꾸는 방법을 알려 주세요 ${answerToken}`;
  const blankTwoAnswer = "필요한 서류도 함께 안내해 주시면 감사하겠습니다.";

  // 1) dashboard
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole("heading").first()).toBeVisible();

  // 2) problem list
  await page.goto("/practice/problems", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/practice\/problems/);
  await expect(page.getByRole("heading").first()).toBeVisible();

  // 3) writing 51 — fill a valid (>= 10 char) answer
  await page.goto("/writing/short-answer-writing-51", {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(500);
  const ta = page.locator("textarea").first();
  await ta.fill(blankOneAnswer);
  await page.getByRole("tab").nth(1).click();
  await ta.fill(blankTwoAnswer);
  await page.waitForTimeout(300);

  // D-M1 submit-confirm modal
  const submitBtn = page.getByRole("button", { name: "제출하기", exact: true });
  await expect(submitBtn).toBeEnabled();
  await submitBtn.click();
  // T-1 (QA 2026-06-12): antd 6은 모달 제목을 클래스 없는 h2로 렌더 —
  // .ant-modal-title 셀렉터는 stale. testid + heading으로 단언한다.
  const confirmModal = page.getByTestId("submission-confirm-modal");
  await expect(confirmModal).toBeVisible();
  await expect(
    confirmModal.getByRole("heading", { name: "답안을 제출하시겠어요?" }),
  ).toBeVisible();

  // 4) submit -> D-M2 on the writing route -> feedback
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
  await confirmModal.getByRole("button", { name: "제출", exact: true }).click();
  await expect(page).toHaveURL(/\/writing\/short-answer-writing-51/);
  await expect(page.getByTestId("analysis-loading-background")).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByTestId("analysis-loading-page")).toBeVisible();
  await expect(page.getByTestId("analysis-loading-panel")).toBeVisible();
  await expect(page.getByTestId("analysis-loading-modal")).toHaveCount(0);
  await expect(page).not.toHaveURL(/\/writing\/feedback\/short\//);
  const submitted = await waitForSubmittedFlowRow(answerToken);
  createdSubmissionIds.push(submitted.id);
  await completeSubmittedFlowRow(submitted);
  completedAnalysisSubmissionIds.add(submitted.id);
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForURL(/\/writing\/feedback\/short\/[0-9a-f-]+/, {
    timeout: 30000,
  });
  const m = page.url().match(/\/writing\/feedback\/short\/([0-9a-f-]+)/);
  const newId = m ? m[1] : null;
  expect(newId, "captured new submission id").toBeTruthy();
  expect(newId).toBe(submitted.id);

  // 5) feedback (E-01) rendered
  await page.waitForTimeout(800);
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole("heading").first()).toBeVisible();

  // 6) save to library — T-1 (QA 2026-06-12): 저장 CTA가 단독 버튼에서
  // Dropdown 그룹(feedback-action-save, 메뉴: 보관함 저장/PDF 저장)으로 바뀜.
  // 이전 단독 "보관함 저장" 버튼 셀렉터는 stale (전용 short-feedback spec 패턴).
  await page.getByTestId("feedback-action-save").click();
  const saveLibraryMenuItem = page.getByRole("menuitem", {
    name: "보관함 저장",
  });
  await expect(saveLibraryMenuItem).toBeVisible();
  await saveLibraryMenuItem.click();
  const saveNotice = page
    .locator(".ant-notification-notice")
    .filter({ hasText: "보관함에 저장했어요." })
    .last();
  await expect(saveNotice).toBeVisible({ timeout: 20000 });
  await saveNotice.locator(".ant-notification-notice-close").click();
  await expect(saveNotice).toBeHidden();

  // 7) comparison report (R-01)
  await page.getByTestId("feedback-action-compare").click();
  await page.waitForURL(/\/writing\/reports\/[0-9a-f-]+\/compare/, {
    timeout: 20000,
  });
  await expect(
    page.getByRole("heading", { name: "비교 리포트" }),
  ).toBeVisible();

  // 8) library (F-01)
  await page.goto("/library", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/library/);
  await expect(page.getByRole("heading").first()).toBeVisible();

  // 9) PDF export modal (F-M1): select an item then open the modal.
  // T-1 (QA 2026-06-12): .ant-modal-title은 antd 6에서 stale — 전용 library
  // spec과 동일한 testid 셀렉터를 쓴다.
  await page.getByTestId("library-select-item").first().click();
  await expect(page.getByTestId("library-export-pdf")).toBeEnabled();
  await page.getByTestId("library-export-pdf").click();
  await expect(page.getByTestId("pdf-export-modal")).toBeVisible({
    timeout: 10000,
  });
});
