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
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch { /* CI */ }
}
loadEnvLocal();

// Track EVERY submission this spec creates (retries create extra rows); clean them all.
const createdSubmissionIds: string[] = [];

test.afterAll(async () => {
  if (createdSubmissionIds.length === 0) return;
  const label = (process.env.SUPABASE_ENV_LABEL || "").toLowerCase();
  if (label === "prod" || label === "production") return; // never touch prod
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return;
  const sb = createClient(url, key, { auth: { persistSession: false } });
  for (const id of createdSubmissionIds) {
    // Delete children first (in case FKs are not ON DELETE CASCADE), then the row.
    await sb.from("comparison_reports").delete().eq("current_submission_id", id);
    await sb.from("library_items").delete().eq("submission_id", id);
    await sb.from("sentence_feedback").delete().eq("submission_id", id);
    await sb.from("feedback_dimension_scores").delete().eq("submission_id", id);
    await sb.from("writing_feedback").delete().eq("submission_id", id);
    await sb.from("writing_submissions").delete().eq("id", id);
  }
  // eslint-disable-next-line no-console
  console.log(`[flow teardown] removed ${createdSubmissionIds.length} flow-created submission(s) + children`);
});

test("core writing flow: dashboard → write → submit → feedback → compare → library → export", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1280", "flow runs once on desktop-1280");
  // 1) dashboard
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole("heading").first()).toBeVisible();

  // 2) problem list
  await page.goto("/practice/problems", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/practice\/problems/);
  await expect(page.getByRole("heading").first()).toBeVisible();

  // 3) writing 51 — fill a valid (>= 10 char) answer
  await page.goto("/writing/short-answer-writing-51", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const ta = page.locator("textarea").first();
  await ta.fill("핵심 사용자 플로우 검증을 위한 충분한 길이의 예시 답안입니다. 감사합니다.");
  await page.waitForTimeout(300);

  // D-M1 submit-confirm modal
  const submitBtn = page.getByRole("button", { name: "제출하기", exact: true });
  await expect(submitBtn).toBeEnabled();
  await submitBtn.click();
  await expect(page.locator(".ant-modal-title", { hasText: "답안을 제출하시겠어요?" })).toBeVisible();

  // 4) agree + submit → feedback (single modal open → page-level locators are unambiguous)
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "제출", exact: true }).click();
  await page.waitForURL(/\/writing\/feedback\/short\/[0-9a-f-]+/, { timeout: 20000 });
  const m = page.url().match(/\/writing\/feedback\/short\/([0-9a-f-]+)/);
  const newId = m ? m[1] : null;
  expect(newId, "captured new submission id").toBeTruthy();
  if (newId) createdSubmissionIds.push(newId);

  // 5) feedback (E-01) rendered
  await page.waitForTimeout(800);
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole("heading").first()).toBeVisible();

  // 6) save to library
  const saveBtn = page.getByRole("button", { name: "보관함 저장", exact: true });
  await saveBtn.click();
  await expect(page.getByRole("button", { name: "보관함에 저장됨", exact: true })).toBeVisible({ timeout: 10000 });

  // 7) comparison report (R-01)
  await page.getByRole("button", { name: "비교 리포트", exact: true }).click();
  await page.waitForURL(/\/writing\/reports\/[0-9a-f-]+\/compare/, { timeout: 20000 });
  await expect(page.getByRole("heading", { name: "비교 리포트" })).toBeVisible();

  // 8) library (F-01)
  await page.goto("/library", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/library/);
  await expect(page.getByRole("heading").first()).toBeVisible();

  // 9) PDF export modal (F-M1): select an item then open the modal
  const cb = page.locator(".ant-checkbox-input").first();
  await cb.check({ force: true });
  await page.getByRole("button", { name: "PDF로 내보내기" }).first().click();
  await expect(page.locator(".ant-modal-title", { hasText: "PDF로 내보내기" })).toBeVisible({ timeout: 10000 });
});
