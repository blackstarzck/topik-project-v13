// F-M1 서버 PDF 실파일 생성 수동 검증 (실사용 전체 흐름):
//   로그인 → 51번 답안 제출 → 피드백 → 보관함 저장 → 서재 선택 → 모달(신규 UI)
//   → PDF 생성 → 실제 다운로드 파일 검증(%PDF 매직 + 크기) + 스크린샷.
// 종료 시 생성 데이터(제출+자식, export_files, 스토리지 파일)를 service role로 정리.
import { readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

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
  } catch {}
}
loadEnvLocal();

const BASE = "http://127.0.0.1:3000";
const EMAIL = process.env.E2E_STUDENT_EMAIL ?? "student@audit.local";
const PASSWORD = process.env.SUPABASE_TEST_PASSWORD ?? "";

let submissionId = null;
let exportId = null;
let storagePath = null;
let failures = [];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));

try {
  // 0) login
  await page.goto(`${BASE}/login`);
  await page.locator('input[autocomplete="email"]').fill(EMAIL);
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL("**/dashboard", { timeout: 15000 });

  // 1) 51번 답안 제출
  await page.goto(`${BASE}/writing/short-answer-writing-51`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.locator("textarea").first().fill("서버 PDF 검증용 예시 답안입니다. 기숙사 생활은 편리하지만 규칙을 지켜야 합니다. 감사합니다.");
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "제출하기", exact: true }).click();
  await page.getByTestId("submission-confirm-modal").waitFor({ state: "visible" });
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "제출", exact: true }).click();
  await page.waitForURL(/\/writing\/feedback\/short\/[0-9a-f-]+/, { timeout: 20000 });
  submissionId = page.url().match(/\/writing\/feedback\/short\/([0-9a-f-]+)/)?.[1] ?? null;
  console.log("submission created:", submissionId ? "yes" : "no");

  // 2) 보관함 저장 (저장 Dropdown)
  await page.waitForTimeout(800);
  await page.getByTestId("feedback-action-save").click();
  await page.getByRole("menuitem", { name: "보관함 저장" }).click();
  await page.getByText("보관함에 저장했어요.").waitFor({ timeout: 10000 });

  // 3) 서재 → 선택 → 모달
  await page.goto(`${BASE}/library`, { waitUntil: "networkidle" });
  await page.getByTestId("library-select-item").first().click();
  await page.getByTestId("library-export-pdf").click();
  await page.getByTestId("pdf-export-modal").waitFor({ state: "visible", timeout: 10000 });

  const checks = {
    selectedSection: await page.getByText("1. 선택한 문제").isVisible(),
    includeSection: await page.getByText("2. 포함할 항목").isVisible(),
    layoutSection: await page.getByText("3. 레이아웃 옵션").isVisible(),
    estimateBadge: await page.getByTestId("pdf-export-page-estimate").innerText(),
    previewItems: await page.getByTestId("pdf-export-preview-item").count(),
  };
  console.log("layout checks:", JSON.stringify(checks));
  if (!checks.selectedSection || !checks.includeSection || !checks.layoutSection) {
    failures.push("hifi sections missing");
  }
  await page.screenshot({ path: ".scratch/qa-diag/manual-shots/fm1-new-modal.png" });

  // 4) privacy → PDF 생성 → 다운로드 검증
  await page.getByTestId("pdf-export-privacy-confirm").click();
  const [apiResponse, download] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/export/pdf"), { timeout: 60000 }),
    page.waitForEvent("download", { timeout: 60000 }),
    page.getByTestId("pdf-export-submit").click(),
  ]);
  console.log("api status:", apiResponse.status());
  if (apiResponse.status() !== 200) failures.push(`api ${apiResponse.status()}`);
  const body = await apiResponse.json().catch(() => null);
  exportId = body?.exportId ?? null;
  storagePath = body?.storagePath ?? null;

  const filePath = ".scratch/qa-diag/manual-shots/fm1-download.pdf";
  await download.saveAs(filePath);
  const buf = readFileSync(filePath);
  const magic = buf.subarray(0, 5).toString("latin1");
  console.log("download:", download.suggestedFilename(), "| size:", buf.length, "| magic:", magic);
  if (magic !== "%PDF-" || buf.length < 20000) failures.push("downloaded file invalid");

  await page.waitForTimeout(500);
  await page.screenshot({ path: ".scratch/qa-diag/manual-shots/fm1-after-generate.png" });
  console.log("pageerrors:", pageErrors.length === 0 ? "none" : pageErrors.join(" | "));
  if (pageErrors.length > 0) failures.push("pageerrors");
} catch (err) {
  failures.push(err instanceof Error ? err.message : String(err));
} finally {
  await ctx.close();
  await browser.close();

  // ---- cleanup (dev only, service role) ----
  const label = (process.env.SUPABASE_ENV_LABEL || "").toLowerCase();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (label !== "prod" && label !== "production" && url && key) {
    const sb = createClient(url, key, { auth: { persistSession: false } });
    if (storagePath) {
      await sb.storage.from("generated-exports").remove([storagePath]);
    }
    if (exportId) {
      await sb.from("library_items").delete().eq("export_id", exportId);
      await sb.from("export_files").delete().eq("id", exportId);
    }
    if (submissionId) {
      await sb.from("comparison_reports").delete().eq("current_submission_id", submissionId);
      await sb.from("library_items").delete().eq("submission_id", submissionId);
      await sb.from("sentence_feedback").delete().eq("submission_id", submissionId);
      await sb.from("feedback_dimension_scores").delete().eq("submission_id", submissionId);
      await sb.from("writing_feedback").delete().eq("submission_id", submissionId);
      await sb.from("writing_submissions").delete().eq("id", submissionId);
    }
    console.log("cleanup: done (submission + export rows + storage object)");
  } else {
    console.log("cleanup: skipped (no service key or prod)");
  }
}

console.log(failures.length === 0 ? "RESULT: PASS" : `RESULT: FAIL — ${failures.join("; ")}`);
process.exit(failures.length === 0 ? 0 : 1);
