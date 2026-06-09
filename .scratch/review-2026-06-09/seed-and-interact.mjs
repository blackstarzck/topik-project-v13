// Seed (via real app flow) + dynamic/modal capture for the 2026-06-09 page-review (Phase 1).
// 1) SEED: on the E-01 feedback page, click 보관함 저장 (→ library_items, F-01) and
//    비교 리포트 (→ comparison_reports + navigate, R-01). Created row ids are recorded
//    to _seed-teardown.json so Phase 5 can delete ONLY what we created.
// 2) CAPTURE: R-01 compare page + populated /library at 1280/360.
// 3) MODALS (best-effort, isolated try/catch): D-M1 submit-confirm, D-M3 autosave-warning,
//    C-03 retry, F-M1 pdf-export. Each: trigger → screenshot → discard context (no commit,
//    so no extra rows). D-M2 (transient AI-loading) is intentionally deferred.
//
// Authed origin 127.0.0.1:3000 + storageState (cookie domain match). READ/WRITE only the
// two seed tables; never prints secrets. Run from repo root after the static capture.
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvLocal, assertNotProd, serviceKey } from "./_env.mjs";

const OUT = ".design-review-shots/20260609";
const STORAGE = "tests/e2e/auth-state/student.json";
const AUTHED = "http://127.0.0.1:3000";
const STUDENT_ID = "4d447f42-7e82-4afd-937c-864b1af92ff7";
const SUB_SHORT = "a0d17000-0000-4000-8000-000000000051"; // q51 feedback complete → E-01
const VIEWPORTS = [1280, 360];
const health = [];

await loadEnvLocal();
const { label } = assertNotProd();
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey(), { auth: { persistSession: false } });
console.log(`env=${label}`);

await mkdir(OUT, { recursive: true });

async function countRows(table) {
  const { count } = await sb.from(table).select("id", { count: "exact", head: true }).eq("user_id", STUDENT_ID);
  return count ?? 0;
}

// Capture the current page at all VIEWPORTS into label-<w>.png + health rows.
async function snap(page, lbl, note) {
  for (const w of VIEWPORTS) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(500);
    const png = path.join(OUT, `${lbl}-${w}.png`);
    let consoleErrCount = 0;
    try { await page.screenshot({ path: png, fullPage: true }); }
    catch (e) { consoleErrCount = -1; console.error(`  snap ${lbl}-${w} failed: ${e.message}`); }
    const bodyLen = await page.evaluate(() => (document.body?.innerText || "").length).catch(() => 0);
    health.push({ label: lbl, viewport: w, finalUrl: page.url().replace(AUTHED, ""), bodyTextLen: bodyLen, png, note: note || null });
    console.log(`  snap ${lbl}-${w}  bodyLen=${bodyLen}`);
  }
}

const browser = await chromium.launch({ headless: true });
const teardown = { createdAt: null, library_items: [], comparison_reports: [] };

// ---------- PART A: SEED via app flow ----------
let reportId = null;
try {
  const beforeLib = await countRows("library_items");
  const beforeRep = await countRows("comparison_reports");
  console.log(`before: library_items=${beforeLib} comparison_reports=${beforeRep}`);

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce", storageState: STORAGE });
  const page = await ctx.newPage();
  await page.goto(`${AUTHED}/writing/feedback/short/${SUB_SHORT}`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(800);

  // F-01 seed: 보관함 저장
  try {
    const saveBtn = page.getByRole("button", { name: "보관함 저장", exact: true });
    await saveBtn.click({ timeout: 8000 });
    await page.waitForTimeout(1500); // let the mutation land
    console.log("clicked 보관함 저장");
  } catch (e) { console.error("save-to-library click failed:", e.message); }

  // R-01 seed: 비교 리포트 → navigates to /writing/reports/<id>/compare
  try {
    const cmpBtn = page.getByRole("button", { name: "비교 리포트", exact: true });
    await cmpBtn.click({ timeout: 8000 });
    await page.waitForURL(/\/writing\/reports\/[^/]+\/compare/, { timeout: 15000 });
    const m = page.url().match(/\/writing\/reports\/([^/]+)\/compare/);
    reportId = m ? m[1] : null;
    console.log("comparison report created → reportId=", reportId);
  } catch (e) { console.error("compare-report click failed:", e.message); }

  await ctx.close();

  // Resolve created ids for surgical teardown (both tables were 0 before).
  const { data: libRows } = await sb.from("library_items").select("id, submission_id, item_type, saved_at").eq("user_id", STUDENT_ID);
  teardown.library_items = (libRows ?? []).map((r) => r.id);
  const { data: repRows } = await sb.from("comparison_reports").select("id, current_submission_id").eq("user_id", STUDENT_ID);
  teardown.comparison_reports = (repRows ?? []).map((r) => r.id);
  console.log(`after: library_items=${teardown.library_items.length} comparison_reports=${teardown.comparison_reports.length}`);
  await writeFile(path.join(OUT, "_seed-teardown.json"), JSON.stringify(teardown, null, 2), "utf8");
} catch (e) { console.error("PART A seed failed:", e.message); }

// ---------- PART B: capture dynamic (R-01 compare, populated /library) ----------
if (reportId) {
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce", storageState: STORAGE });
    const page = await ctx.newPage();
    await page.goto(`${AUTHED}/writing/reports/${reportId}/compare`, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(800);
    await snap(page, "16-R-01-comparison-report", "seeded report");
    await ctx.close();
  } catch (e) { console.error("R-01 capture failed:", e.message); }
}
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce", storageState: STORAGE });
  const page = await ctx.newPage();
  await page.goto(`${AUTHED}/library`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(800);
  await snap(page, "18-F-01-my-library-populated", "after seed");
  await ctx.close();
} catch (e) { console.error("F-01 populated capture failed:", e.message); }

// ---------- PART C: modals (best-effort) ----------
async function modalCapture(name, lbl, fn) {
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce", storageState: STORAGE });
    const page = await ctx.newPage();
    await fn(page);
    // wait for a visible antd modal
    await page.locator(".ant-modal-content").first().waitFor({ state: "visible", timeout: 8000 });
    await page.waitForTimeout(500);
    await snap(page, lbl, "modal");
    await ctx.close();
    console.log(`modal ${name} captured`);
  } catch (e) {
    console.error(`modal ${name} FAILED → deferred: ${e.message}`);
    health.push({ label: lbl, viewport: null, finalUrl: null, bodyTextLen: 0, png: null, note: "DEFERRED: " + e.message.slice(0, 120) });
  }
}

// D-M1 submit-confirm: fill q51 ≥10 chars → 제출하기 → modal (do NOT confirm).
await modalCapture("D-M1 submit-confirm", "12-D-M1-submission-confirmation-modal", async (page) => {
  await page.goto(`${AUTHED}/writing/short-answer-writing-51`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(600);
  await page.locator("textarea").first().fill("이것은 제출 확인 모달 캡처를 위한 충분한 길이의 예시 답안입니다.");
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "제출하기", exact: true }).click({ timeout: 8000 });
});

// D-M3 autosave-warning: type → 자동 저장 끄기 → disable_attempt warning modal.
await modalCapture("D-M3 autosave-warning", "22-D-M3-autosave-warning", async (page) => {
  await page.goto(`${AUTHED}/writing/short-answer-writing-51`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(600);
  await page.locator("textarea").first().fill("자동 저장 경고 모달 캡처용 예시 답안 텍스트입니다.");
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "자동 저장 끄기", exact: true }).click({ timeout: 8000 });
});

// C-03 retry: solved filter → 다시 풀기 on first solved row → RetryModal.
await modalCapture("C-03 retry", "07-C-03-retry-modal", async (page) => {
  await page.goto(`${AUTHED}/practice/problems?solve=solved`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "다시 풀기", exact: true }).first().click({ timeout: 9000 });
});

// F-M1 pdf-export: /library submissions → select first item → PDF로 내보내기 → modal.
await modalCapture("F-M1 pdf-export", "19-F-M1-pdf-export-modal", async (page) => {
  await page.goto(`${AUTHED}/library`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(1000);
  // select the first submission (checkbox) to enable export
  const cb = page.locator(".ant-checkbox-input").first();
  await cb.click({ timeout: 8000 });
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "PDF로 내보내기", exact: true }).click({ timeout: 8000 });
});

await browser.close();
await writeFile(path.join(OUT, "_health-interactive.json"), JSON.stringify({ count: health.length, shots: health }, null, 2), "utf8");
console.log(`\ninteractive health → ${path.join(OUT, "_health-interactive.json")} (${health.length} entries)`);
console.log("DONE");
